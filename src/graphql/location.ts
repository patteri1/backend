import { Location, Storage, Product } from "../model"

export const typeDef = `
    extend type Query {
        location(locationId: Int!): Location
        allLocations: [Location]
    } 

    extend type Mutation {
        updateLocation(locationId: Int!, input: LocationInput!): Location
        addStorageToLocation(locationId: Int!, productId: Int!, palletAmount: Int!): Location
        
    }
 
    type Location {
        locationId: Int!
        locationName: String!
        address: String!
        postCode: String!
        city: String!
        locationType: String!
        locationPrices: [LocationPrice]!
        storages: [Storage]!
    }

    input LocationInput {
        locationName: String
        address: String
        postCode: String
        city: String
        locationType: String
    }

    type LocationPrice {
        locationPriceId: Int!
        locationId: Int!
        price: Float!
        validFrom: String!
    }
`

interface UpdateLocationArgs {
    locationId: number
    input: LocationInput
}

interface LocationInput {
    locationName?: string
    address?: string
    postCode?: string
    city?: string
    locationType?: string
}

export const resolvers = {
    Query: {
        location: async (_: unknown, args: { locationId: number }) => {
            const { locationId } = args

            try {
                const location = await Location.findByPk(locationId, {
                    include: [{
                        model: Storage,
                        include: [Product]
                    },
                ]
                })
                if (!location) {
                    throw new Error(`Location with ID ${locationId} not found`)
                }

                return location

            } catch (error) {
                console.log(error)
                throw new Error(`Error retrieving location with ID ${locationId}`)
            }
        },

        // get all locations
        allLocations: async () => {
            try {
                const allLocations = await Location.findAll({
                    include: [{
                        model: Storage,
                        include: [Product],
                    }]
                })

                return allLocations

            } catch (error) {
                console.log(error)
                throw new Error('Error retrieving all locations ')
            }
        },


    },
    Mutation: {
        updateLocation: async (_: unknown, { locationId, input }: UpdateLocationArgs): Promise<Location> => {
            try {
                console.log(locationId)
                const locationToUpdate = await Location.findByPk(locationId)
                if (!locationToUpdate) {
                    throw new Error('Location not found')
                }
                Object.assign(locationToUpdate, input)
                await locationToUpdate.save();
                return locationToUpdate
            } catch (error) {
                if (error instanceof Error) {
                    throw new Error(`Failed to update location: ${error.message}`)
                } else {
                    throw new Error(`Failed to update location with ID ${locationId}: Unknown error`)
                }
            }
        },
        addStorageToLocation: async (_: unknown, args: { locationId: number, productId: number, palletAmount: number }) => {
            try {
                const location = await Location.findByPk(args.locationId);
                const product = await Product.findByPk(args.productId);

                if (!location || !product) {
                    throw new Error(`Location or Product not found`);
                }

                const existingStorage = await Storage.findOne({
                    where: {
                        locationId: args.locationId,
                        productId: args.productId,
                    },
                });

                if (existingStorage) {
                    throw new Error(`Product already exists for this Location`);
                }

                const newStorage = await Storage.create({
                    locationId: args.locationId,
                    productId: args.productId,
                    palletAmount: args.palletAmount,
                });

                return newStorage;
            } catch (error) {
                console.error(error);
                throw new Error(`Error adding Storage to Location`);
            }
        },

    }
};
