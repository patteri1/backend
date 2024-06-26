
import { Location, Storage, Product, LocationPrice } from "../model"
import { Op } from "sequelize"
import { sequelize } from "../util/db"
import { MyContext } from "./context"
import { checkAdmin, checkAdminOrOwner, checkHasRole } from "./util/authorizationChecks"

export const typeDef = `
    extend type Query {
        location(locationId: Int!): Location
        allLocations: [Location]
        locationsByType(locationType: String!): [Location]
        locationWithStorages(locationId: Int!): Location
        locationsWithStorages(locationIds: [Int!]!): [Location]
        allLocationsWithPrice: [Location]
    } 

    extend type Mutation {
        deleteLocation(id: Int!): Location
        addLocation(location: LocationInput!): Location
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
        location: async (_: unknown, args: { locationId: number }, context: MyContext) => {
            const { locationId } = args
            
            checkHasRole(context)

            try {

                const location = await Location.findByPk(locationId, {
                    include: [{
                        model: Storage,
                        include: [Product]
                    },
                    {
                        model: LocationPrice,
                    }
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
        allLocations: async (_: unknown, __: unknown, context: MyContext) => {
            checkHasRole(context)
            
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
        // get locations by type (Kuljetusliike / Käsittelylaitos)
        locationsByType: async (_: unknown, args: { locationType: string }, context: MyContext) => {
            checkHasRole(context)

            try {

                const locations = await Location.findAll({
                    where: {locationType: args.locationType}
                })

                return locations
            } catch (error) {
                console.log(error)
                throw new Error('Error retrieving locations by type')
            }
        },
        locationWithStorages: async (_: unknown, args: { locationId: number }, context: MyContext) => {
            const { locationId } = args
            const currentDate = new Date()

            checkAdminOrOwner(context, locationId)

            try {            
                const location = await Location.findByPk(locationId, {
                    include: [{
                        model: LocationPrice,
                        attributes: ['price', 'validFrom'],
                        where: {
                            validFrom: {
                                [Op.lte]: currentDate
                            }
                        },
                        order: [['validFrom', 'DESC']],
                        limit: 1,
                    }, {
                        model: Storage,
                        where: {
                            createdAt: {
                                [Op.in]: sequelize.literal(`(
                                    SELECT MAX("createdAt") 
                                    FROM "storage"
                                    WHERE "locationId" = :locationId
                                    GROUP BY "productId"
                                 )`)
                            },
                        },
                        include: [{
                            model: Product,
                            required: false
                        }],
                        required: false
                    }],
                    replacements: { locationId: locationId },
                })
                
                return location
            } catch (error) {
                console.log(error)
                throw new Error(`Error retrieving location with id ${locationId}`)
            }
        },
        allLocationsWithPrice: async (_: unknown, __: unknown, context: MyContext) => {
            checkHasRole(context)
            
            try {

                const locations = await Location.findAll({
                    include: [{
                        model: LocationPrice,
                        attributes: ['price', 'validFrom'],
                        order: [['validFrom', 'DESC']],
                    }]
                })
        
                return locations
        
            } catch (error) {
                throw new Error('Error retrieving all locations ')
            }
        },

        locationsWithStorages: async (_: unknown, args: { locationIds: number[] }, context: MyContext): Promise<Location[]> => {
            const currentDate = new Date();
            const { locationIds } = args
            
            if (!Array.isArray(locationIds) || locationIds.length === 0) {
                throw new Error('Invalid input: locationIds must be a non-empty array.');
            }
            
            // admin can access all, others only their own
            if (locationIds.length > 1) {
                checkAdmin(context)
            } else {
                checkAdminOrOwner(context, locationIds[0])
            }

            try {
                const locations: Location[] = await Location.findAll({
                    where: {
                        locationId: {
                            [Op.in]: locationIds
                        }
                    },
                    include: [
                        {
                            model: LocationPrice,
                            attributes: ['price', 'validFrom'],
                            where: {
                                validFrom: {
                                    [Op.lte]: currentDate
                                }
                            },
                            order: [['validFrom', 'DESC']],
                            limit: 1,
                        },
                        {
                            model: Storage,
                            include: [Product],
                            where: sequelize.literal(`(
                                ("productId", "location"."locationId", "createdAt")
                                IN (
                                    SELECT subquery."productId", subquery."locationId", subquery."createdAt"
                                    FROM (
                                        SELECT 
                                            s."productId",
                                            l."locationId",
                                            s."createdAt",
                                            ROW_NUMBER() OVER(PARTITION BY s."productId", s."locationId" ORDER BY s."createdAt" DESC) AS rn
                                        FROM 
                                            storage s
                                        JOIN 
                                            location l ON s."locationId" = l."locationId"
                                    ) AS subquery
                                    WHERE rn = 1
                                )
                            )`),
                        }
                    ],
                    order: ['locationId']
                });

                return locations;

            } catch (error) {
                console.log(error);
                throw new Error(`Error retrieving locations`)
            }
        }
    },
    Mutation: {
        addLocation: async (_: unknown, { location }: { location: LocationInput }, context: MyContext) => {
            checkAdmin(context)
            
            try {

                const newLocation = await Location.create(location as Partial<Location>)
                return newLocation
            } catch (error) {
                throw new Error(`Unable to add location: ${error}`)

            }
        },
        deleteLocation: async (_: unknown, { id }: { id: number }, context: MyContext) => {
            checkAdmin(context)
            
            try {
                const locationToDelete = await Location.findByPk(id)

                if (!locationToDelete) {
                    throw new Error(`Location with id: ${id} not found`)
                }

                await locationToDelete.destroy()
                return locationToDelete

            } catch (error) {
                throw new Error(`Unable to delete location by id: ${id}`)
            }
        },
        updateLocation: async (_: unknown, { locationId, input }: UpdateLocationArgs, context: MyContext): Promise<Location> => {
            checkAdminOrOwner(context, locationId)
            
            try {
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
        addStorageToLocation: async (_: unknown, args: { locationId: number, productId: number, palletAmount: number }, context: MyContext) => {
            checkAdminOrOwner(context, args.locationId);
            
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
}