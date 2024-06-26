import { Op } from 'sequelize'
import { Order, OrderRow } from '../model/'
import { checkAdminOrOwner, checkHasRole } from './util/authorizationChecks'
import { MyContext } from './context'

export const typeDef = `
    extend type Query {
        order(orderId: Int!): Order
        allOrders: [Order]
        openOrders(locationIds: [Int!]!): [Order]
        closedOrders(locationIds: [Int!]!): [Order]
    }

    extend type Mutation {
        addOrder(input: AddOrderInput!): Order!
        collectOrder(orderId: Int!): Order
        cancelOrder(orderId: Int!): Order
    }

    type Order {
        orderId: Int!
        location: Location!
        createdAt: String
        updatedAt: String
        status: String
        orderRows: [OrderRow]
    }

    type OrderRow {
        order: Order!
        product: Product!
        palletAmount: Int!
    }

    type Product {
        productId: Int!
        productName: String
        productAmount: Int!
    }

    input AddOrderInput {
        locationId: Int!
        status: String
        orderRows: [OrderRowInput]
    }

    input OrderRowInput {
        productId: Int!
        palletAmount: Int!
    }
`

interface AddOrderInput {
    locationId: number
    status: string
    orderRows: OrderRowInput[]
}

interface OrderRowInput {
    productId: number
    palletAmount: number
}

export const resolvers = {
    Query: {
        // get order by id
        order: async (_: unknown, args: { orderId: number }, context: MyContext) => {
            checkHasRole(context)
            const { orderId } = args

            try {
                const order = await Order.findByPk(orderId, {
                    include: [
                        'location', 
                        {
                            model: OrderRow, 
                            where: { orderId: orderId }, 
                            include: ['product']
                        }
                    ]
                })
                if (!order) {
                    throw new Error(`Order with ID ${orderId} not found`)
                }

                return order

            } catch (error) {
                console.log(error);
                throw new Error(`Error retrieving order with ID ${orderId}`)
            }
        },
        // get all orders (without rows)
        allOrders: async (_:unknown, context: MyContext) =>  { 
            checkHasRole(context)
            try {
                const allOrders = await Order.findAll({
                    include: 'location'
                })

                return allOrders

            } catch (error) {
                console.log(error)
                throw new Error('Error retrieving all orders ')
            }
        },
        // get all open orders (status Avattu)
        openOrders: async (_: unknown, args: { locationIds: number[] }, context: MyContext): Promise<Order[]> =>  { 
            checkHasRole(context)
            const { locationIds } = args
            if (!Array.isArray(locationIds) || locationIds.length === 0) {
                throw new Error('Invalid input: locationIds must be a non-empty array.');
            }
            
            try {
                const orders = await Order.findAll({
                    include: 'location', 
                    where: { 
                        status: 'Avattu',
                        locationId: {
                            [Op.in]: locationIds
                        }
                    },
                    order: [['createdAt', 'DESC']]
                })

                return orders

            } catch (error) {
                console.log(error)
                throw new Error('Error retrieving open orders')
            }
        },
        // get all closed orders (status Noudettu/Peruttu)
        closedOrders: async (_: unknown, args: { locationIds: number[] }, context: MyContext): Promise<Order[]> =>  { 
            checkHasRole(context)
            const { locationIds } = args
            if (!Array.isArray(locationIds) || locationIds.length === 0) {
                throw new Error('Invalid input: locationIds must be a non-empty array.');
            }
            try {
                const orders = await Order.findAll({
                    include: 'location', 
                    where: { 
                        status: {
                            [Op.or]: ['Noudettu', 'Peruttu']
                        },
                        locationId: {
                            [Op.in]: locationIds
                        }
                    },
                    order: [['createdAt', 'DESC']]
                })

                return orders

            } catch (error) {
                console.log(error)
                throw new Error('Error retrieving closed orders')
            }
        }
    },
    Mutation: {
        addOrder: async (_: unknown, { input }: { input: AddOrderInput }, context: { user?: any }) => {
            try {
                const { locationId, status, orderRows } = input
                checkAdminOrOwner(context, locationId)
                const order: Order = await Order.create({
                    locationId: locationId,
                    status,
                })

                // add rows
                const rows = orderRows.map(rowInput => ({
                    orderId: order.orderId,
                    productId: rowInput.productId,
                    palletAmount: rowInput.palletAmount
                }))
                await OrderRow.bulkCreate(rows)

                return {
                    orderId: order.orderId,
                    location: {
                        locationId: locationId,
                        
                    },
                    createdAt: order.createdAt,
                    status: order.status,
                    orderRows: rows
                }

            } catch (error) {
                console.log(error)
                throw new Error('Error adding new order')
            }
        },
        // mark order as collected
        collectOrder: async (_: unknown, args: { orderId: number }, context: MyContext) => {
            checkHasRole(context)
            const { orderId } = args

            try {
                const order = await Order.findByPk(orderId, {
                    include: [
                        'location', 
                        {
                            model: OrderRow, 
                            where: { orderId: orderId }, 
                            include: ['product']
                        }
                    ]
                })
                if (!order) {
                    throw new Error(`Order with ID ${orderId} not found`)
                }
                order.status = 'Noudettu'
                await order.save()

                // todo: reduce pallets from käsittelylaitos
                // and add pallets to kuljetusliike
                
                return order

            } catch (error) {
                console.log(error);
                throw new Error(`Error collecting order ${orderId}`)
            }
        },
        // mark order as cancelled
        cancelOrder: async (_: unknown, args: { orderId: number }, context: MyContext) => {
            checkHasRole(context)
            const { orderId } = args

            try {
                const order = await Order.findByPk(orderId, {
                    include: [
                        'location', 
                        {
                            model: OrderRow, 
                            where: { orderId: orderId }, 
                            include: ['product']
                        }
                    ]
                })
                if (!order) {
                    throw new Error(`Order with ID ${orderId} not found`)
                }
                order.status = 'Peruttu'
                await order.save()
                
                return order

            } catch (error) {
                console.log(error);
                throw new Error(`Error cancelling order ${orderId}`)
            }
        }
    }
}