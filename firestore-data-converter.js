
/**
 * @typedef {object} FirestoreDataConverterOptions
 * 
 * @property {Object.<string, Function>} [toFirestoreConverters={}] Custom converters for specific types to Firestore.
 * @property {Object.<string, Function>} [fromFirestoreConverters={}] Custom converters for specific types from Firestore.
 * @property {"omit" | "null"} [undefinedValues="omit"] How to handle undefined values. `omit` will omit the property from the Firestore document. `null` will set the property to null.
 * @property {"omit" | "convert" | "error"} [multidimensionalArrays="convert"] Whether to convert multidimensional arrays to Firestore arrays. Firestore can't handle multidimensional arrays. `convert` will convert the nested arrays to objects with numeric keys. It will be converted back to a multidimensional array when read from Firestore.
 * @property {"omit" | "convert" | "error"} [functions="omit"] Whether to convert functions to Firestore objects. Firestore can't handle functions. `convert` will convert the function to an object with a `string` property containing the function's source code. It will be converted back to a function when read from Firestore.
 * NOTE: this can be dangerous
 * @property {"omit" | "convert" | "error"} [classInstances="convert"] Whether to convert class instances to Firestore objects. Firestore can't handle class instances. `convert` will convert the class instance to an object with a `_constructor` property containing the class name. It will not be converted back when read from Firestore.
 * @property {"omit" | "return" | "error"} [fallback="return"] What to do when a value can't be converted. `return` will return the value as-is. `omit` will omit the property from the Firestore document. `error` will throw an error.
 * @property {string} [constructorKey="_constructor"] The key to use for the `_constructor` property when converting class instances to Firestore objects.
 */

export class FirestoreDataConverter {
    /**
     * @param {FirestoreDataConverterOptions} options
     */
    constructor(options = {}) {
        this.options = options
        this.options.toFirestoreConverters ??= {}
        this.options.fromFirestoreConverters ??= {}
        this.options.undefinedValues ??= "omit"
        this.options.multidimensionalArrays ??= "convert"
        this.options.functions ??= "omit"
        this.options.classInstances ??= "convert"
        this.options.fallback ??= "return"
        this.options.constructorKey ??= "_constructor"
    }

    toFirestore(modelObject) {
        return this.convertValueToFirestore(modelObject)
    }

    fromFirestore(snapshot, options) {
        const data = snapshot.data(options)
        return this.convertValueFromFirestore(data)
    }

    convertValueToFirestore(value, insideArray = false) {

        // Case: custom converter
        // Takes precedence over all other cases
        if (typeof value in this.options.toFirestoreConverters) {
            const customValue = this.options.toFirestoreConverters[typeof value](value)

            if (!(customValue instanceof ContinueConversion))
                return customValue
        }

        const constructorName = value?.constructor?.name
        if (constructorName && constructorName in this.options.toFirestoreConverters) {
            const customValue = this.options.toFirestoreConverters[constructorName](value)

            if (!(customValue instanceof ContinueConversion))
                return customValue
        }

        // Case: null
        if (value === null)
            return null

        // Case: undefined
        if (value === undefined) {
            switch (this.options.undefinedValues) {
                case "omit":
                    return undefined
                case "null":
                    return null
                default:
                    throw new Error(`Invalid value for undefinedValues: ${this.options.undefinedValues}`)
            }
        }

        // Cases: number, boolean, string, bigint, symbol
        switch (typeof value) {
            case "number":
            case "boolean":
            case "string":
            case "bigint":
                return value
            case "symbol":
                return value.toString()
        }

        // Case: Firestore types
        switch (constructorName) {
            case "DocumentReference":
            case "GeoPoint":
            case "Timestamp":
            case "FieldValue":
                return value
        }

        // Case: Date
        // Firestore will convert Date objects to Timestamps
        if (value instanceof Date)
            return value

        // Case: Function
        if (typeof value === "function") {
            switch (this.options.functions) {
                case "convert":
                    return {
                        [this.options.constructorKey]: "Function",
                        name: value.name,
                        string: value.toString(),
                    }
                case "omit":
                    return undefined
                case "error":
                    throw new Error("Firestore can't handle functions")
            }
        }

        // Case: Array
        // Firestore can't handle multi-dimensional arrays
        if (Array.isArray(value)) {
            if (insideArray) {
                switch (this.options.multidimensionalArrays) {
                    case "convert":
                        return this.convertToTypedPlainObject(value)
                    case "omit":
                        return undefined
                    case "error":
                        throw new Error("Firestore can't handle multi-dimensional arrays")
                    default:
                        throw new Error(`Invalid value for multidimensionalArrays: ${this.options.multidimensionalArrays}`)
                }
            }

            return value.map(item => this.convertValueToFirestore(item, true))
        }

        // Case: Plain object
        if (value?.constructor === Object) {
            const result = {}
            for (const [key, val] of Object.entries(value)) {
                result[key] = this.convertValueToFirestore(val)
            }
            return result
        }

        // Case: Class instance
        if (typeof value === "object") {
            return this.convertToTypedPlainObject(value)
        }

        // Case: unknown
        switch (this.options.fallback) {
            case "return":
                return value
            case "omit":
                return undefined
            case "error":
                throw new Error(`Can't convert value to Firestore: ${value}`)
            default:
                throw new Error(`Invalid value for fallback: ${this.options.fallback}`)
        }
    }

    convertValueFromFirestore(value) {

        // Case: custom converter
        // Takes precedence over all other cases
        if (typeof value in this.options.fromFirestoreConverters) {
            const customValue = this.options.fromFirestoreConverters[typeof value](value)

            if (!(customValue instanceof ContinueConversion))
                return customValue
        }

        const constructorName = value?.constructor?.name
        if (constructorName && constructorName in this.options.fromFirestoreConverters) {
            const customValue = this.options.fromFirestoreConverters[constructorName](value)

            if (!(customValue instanceof ContinueConversion))
                return customValue
        }

        // Case: Timestamp
        if (value?.constructor?.name === "Timestamp") {
            return value.toDate()
        }

        // Case: Array
        if (Array.isArray(value)) {
            return value.map(item => this.convertValueFromFirestore(item))
        }

        // Case: converted Arrays
        if (this.options.multidimensionalArrays === "convert" && value?.[this.options.constructorKey] === "Array") {
            const result = []
            for (const [key, val] of Object.entries(value)) {
                if (key === this.options.constructorKey)
                    continue

                result[key] = this.convertValueFromFirestore(val)
            }
            return result
        }

        // Case: converted Functions
        if (this.options.functions === "convert" && value?.[this.options.constructorKey] === "Function") {
            return new Function(`return ${value.string}`)()
        }

        // Case: Objects
        if (typeof value === "object") {
            const result = {}
            for (const [key, val] of Object.entries(value)) {
                result[key] = this.convertValueFromFirestore(val)
            }
            return result
        }

        return value
    }

    convertToTypedPlainObject(object, convertValues = true) {
        const plainObject = Object.fromEntries(
            Object.getOwnPropertyNames(object)
                .map(key => [
                    key,
                    convertValues ?
                        this.convertValueToFirestore(object[key]) :
                        object[key]
                ])
        )

        plainObject[this.options.constructorKey] = object.constructor.name

        return plainObject
    }
}


export class ContinueConversion { }