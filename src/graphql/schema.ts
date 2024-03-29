import { makeExecutableSchema } from '@graphql-tools/schema'
import { merge } from 'lodash' // to merge resolver strings easier

import { typeDef as Location, resolvers as locationResolvers } from './location'

// this is extended, fake empty field added as you cannot have an empty type
const Query = `
    type Query {
        _empty: String
    }
`

// resolvers from other files are merged to this
const resolvers = {}

// put everything together and make the schema
export const schema = makeExecutableSchema({
    typeDefs: [Query, Location],
    resolvers: merge(resolvers, locationResolvers),
})