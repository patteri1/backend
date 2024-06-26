import { Storage, Product, Location, Order, OrderRow } from '../model'
import { Op } from "sequelize"
import { sequelize } from "../util/db"
import { MyContext } from './context'
import { checkHasRole } from './util/authorizationChecks'

export const typeDef = `
    extend type Query {
        allStorages: [Storage]
        availableStorages: [Storage]
    } 

    extend type Mutation {
        setAmountToStorage(locationId: Int!, productId: Int!, palletAmount: Int!): Storage
        addPallets(storageInput: StorageInput!): Storage
        collectPallets(storageInput: StorageInput!): Storage
    }

    type Storage {
        storageId: Int!
        locationId: Int!
        productId: Int!
        palletAmount: Int!
        product: Product!
        createdAt: String
    }

    input StorageInput {
        locationId: Int!
        storageRows: [StorageRowInput]!
    }

    input StorageRowInput {
        productId: Int!
        palletAmount: Int!
    }
`

interface StorageInput {
    locationId: number
    storageRows: [StorageRowInput]
}

interface StorageRowInput {
    productId: number
    palletAmount: number
}

export const resolvers = {
    Query: {
        allStorages: async (_: unknown, __: unknown, context: MyContext) => {
            checkHasRole(context)
            try {
                const allStorages = await Storage.findAll({ include: Product })
                return allStorages
            } catch (error) {
                console.log(error)
                throw new Error('Error retrieving all storages')
            }
        },
        // storages available for ordering
        availableStorages: async (_: unknown, __: unknown, context: MyContext) => {
            checkHasRole(context)
            try {
                // get current storages in käsittelylaitos
                const storages = await Storage.findAll({
                    include: [
                        {
                            model: Location, 
                            where: { locationType: 'Käsittelylaitos' }
                        },
                        Product, 
                    ],
                    where: sequelize.literal(`(
                        (storage."productId", storage."createdAt")
                        IN (
                            SELECT "productId", MAX("createdAt") 
                            FROM storage s
                            JOIN location l ON s."locationId" = l."locationId"
                            WHERE "locationType" = 'Käsittelylaitos' 
                            GROUP BY "productId"
                        )
                    )`),
                    order: [['productId', 'ASC']]
                },
                )

                // get open order rows
                const orderRows = await OrderRow.findAll({
                    include: [
                        {
                            model: Order,
                            attributes: ['status'],
                            where: { 
                                status: 'Avattu' 
                            },
                        },
                        Product,
                    ],
                })

                // storages - orders = available pallets
                const availableStorages = storages.map(storage => {
                    const rows = orderRows.filter(row => row.productId === storage.productId)
                    const amount = rows.reduce((total, row) => total + row.palletAmount, 0)
                    return {
                        ...storage,
                        palletAmount: storage.palletAmount - amount
                    }
                })
                
                return availableStorages

            } catch (error) {
                console.log(error)
                throw new Error(`Error retrieving available pallets: ${error}`)
            }
        }
    },
    Mutation: {
        collectPallets: async (_: unknown, { storageInput }: { storageInput: StorageInput }, context: MyContext) => {
            checkHasRole(context)
            try {
                // get current storages
                const storages = await Storage.findAll({
                    include: [
                        Location,
                        Product, 
                    ],
                    where: sequelize.literal(`(
                        (storage."productId", storage."createdAt")
                        IN (
                            SELECT "productId", MAX("createdAt") 
                            FROM storage
                            WHERE "locationId" = :locationId 
                            GROUP BY "productId"
                        )
                    )`),
                    replacements: { locationId: storageInput.locationId },
                },
                )

                // add rows (palletAmount: current + input)
                const rows = storageInput.storageRows.map((row) => {
                    const storage = storages.find(storage => storage.productId === row.productId)
                    return {
                        locationId: storageInput.locationId,
                        productId: row.productId,
                        palletAmount: storage?.palletAmount ? storage.palletAmount + row.palletAmount : row.palletAmount
                    }
                })
                Storage.bulkCreate(rows)

                return rows[0]

            } catch (error) {
                console.log(error)
                throw new Error(`Error: addPallets`);
            }
        },
        addPallets: async (_: unknown, { storageInput }: { storageInput: StorageInput }, context: MyContext) => {
            checkHasRole(context)
            try {
                // get current storages
                const storages = await Storage.findAll({
                    include: [
                        Location,
                        Product, 
                    ],
                    where: sequelize.literal(`(
                        (storage."productId", storage."createdAt")
                        IN (
                            SELECT "productId", MAX("createdAt") 
                            FROM storage
                            WHERE "locationId" = :locationId 
                            GROUP BY "productId"
                        )
                    )`),
                    replacements: { locationId: storageInput.locationId },
                },
                )

                const rows = storageInput.storageRows.map((row) => {
                    const storage = storages.find(storage => storage.productId === row.productId)
                    return {
                        locationId: storageInput.locationId,
                        productId: row.productId,
                        palletAmount: row.palletAmount
                    }
                })
                Storage.bulkCreate(rows)

                return rows[0]

            } catch (error) {
                console.log(error)
                throw new Error(`Error: addPallets`);
            }
        }

    }


}


