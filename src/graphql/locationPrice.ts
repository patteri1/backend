import { LocationPrice } from '../model'
import { MyContext } from "./context"
import { checkAdminOrOwner } from './util/authorizationChecks'

export const typeDef = `
    extend type Mutation {
        addLocationPrice(locationPrice: LocationPriceInput!): LocationPrice
    }

    input LocationPriceInput {
        locationId: Int!
        price: Float!,
        validFrom: String!
    }
`

interface LocationPriceInput {
    locationId: number,
    price: number,
    validFrom: string
}

export const resolvers = {
    Mutation: {
        addLocationPrice: async (_: unknown, { locationPrice }: { locationPrice: LocationPriceInput }, context: MyContext) => {
            try {
                checkAdminOrOwner(context, locationPrice.locationId)
                const newPrice = LocationPrice.create(locationPrice as Partial<LocationPrice>)
                return newPrice
            } catch (error) {
                throw new Error(`Unable to add price for location ${locationPrice.locationId}: ${error}`)
            }
        }
    },
}