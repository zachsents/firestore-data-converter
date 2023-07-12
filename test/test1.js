import { ContinueConversion, FirestoreDataConverter } from "../firestore-data-converter.js"
import util from "util"


const converter = new FirestoreDataConverter({
    multidimensionalArrays: "convert",

    fromFirestoreConverters: {
        "object": value => {
            if (value?._constructor === "Error") {
                return new Error(value.message)
            }

            return new ContinueConversion()
        }
    }
})


class FieldValue { }
class ServerTimestampTransform extends FieldValue { }


testToFirestore({
    a: 1,
    b: "poopy",
    c: [3, "poopy", [6, 7, 8]],
    d: new Error("poopy"),
    e: new Date(),
    f: function test(a) {
        console.log("poopy")
    },
    g: new ServerTimestampTransform(),
})


function testToFirestore(value) {

    const print = (value) => console.log(util.inspect(value, {
        depth: Infinity,
        colors: true,
    }))

    const convertedValue = converter.toFirestore(value)
    const convertedBackValue = converter.fromFirestore({ data: () => convertedValue })

    console.log("Initial")
    print(value)
    console.log("To Firestore")
    print(convertedValue)
    console.log("From Firestore")
    print(convertedBackValue)
}