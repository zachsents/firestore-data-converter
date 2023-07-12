
/**
 * Checks if an object is an instance of a class.
 *
 * @export
 * @param {*} object
 * @param {string} type
 * @return {boolean} 
 */
export function isInstanceOf(object, type) {
    if (object == null)
        return false

    let proto = Object.getPrototypeOf(object)

    while (proto) {
        const constructorName = proto.constructor.name

        if (constructorName === type)
            return true

        proto = Object.getPrototypeOf(proto)
    }

    return false
}