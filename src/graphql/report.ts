import { Location, LocationPrice, PalletType, Storage } from '../model';
import { createDailyReports } from './util/reportUtils';
import { sequelize } from '../util/db';
import { Op, QueryTypes } from 'sequelize';

export const typeDef: string = `
    extend type Query {
        report(input: ReportInput!): Report!
    }

    input ReportInput {
        startDate: String!
        endDate: String!
        locationIds: [Int]!
    }

    type Report {
        locationReports: [LocationReport]!
    }

    type LocationReport {
        location: Location!
        dailyReports: [DailyReport]!
        totalCost: Int!
    }

    type DailyReport {
        date: String!
        productReports: [ProductReport]
        totalDailyPallets: Int!
        totalDailyCost: Int!
    }

    type ProductReport {
        palletType: PalletType!
        palletAmount: Int!
        cost: Int!
    }
`

export interface ReportInput {
    startDate: string
    endDate: string
    locationIds: number[]
}

interface Report {
    locationReports: LocationReport[]
}

export interface LocationReport {
    location: Location
    dailyReports: DailyReport[]
    totalCost: number
}

export interface DailyReport {
    date: string
    productReports: ProductReport[]
    totalDailyPallets: number
    totalDailyCost: number
}

export interface ProductReport {
    palletType: PalletType
    palletAmount: number
    cost: number
}

export const resolvers = {
    Query: {
        report: async (_: unknown, args: { input: ReportInput }): Promise<Report> => {

            const startDate: Date = new Date(args.input.startDate)
            const endDate: Date = new Date(args.input.endDate)

            // fetch matching ids specified in the query
            const { locationIds } = args.input

            // Fetch matching locations specified in the query
            const locations: Location[] = await Location.findAll({
                where: {
                    locationId: {
                        [Op.in]: locationIds
                    }
                },
                include: [
                    {
                        model: Storage,
                        include: [PalletType]
                    }
                ]
            });
            
            // get valid prices for the date range
            const priceQuery: string = ` 
            -- Prices that are valid at on start date
            SELECT "lp"."locationPriceId", "lp"."price", "lp"."validFrom", "lp"."locationId"
            FROM "locationPrice" "lp"
            WHERE "lp"."validFrom" = (
                SELECT MAX("lp2"."validFrom")
                FROM "locationPrice" "lp2"
                WHERE "lp2"."validFrom" <= :startDate
                AND "lp2"."locationId" = "lp"."locationId"
            )
            AND "lp"."locationId" IN (:locationIds)
            
            UNION
            
            -- Price changes within the date range
            SELECT "lp"."locationPriceId", "lp"."price", "lp"."validFrom", "lp"."locationId"
            FROM "locationPrice" "lp"
            WHERE "lp"."validFrom" >= :startDate
            AND "lp"."validFrom" <= :endDate
            AND "lp"."locationId" IN (:locationIds);
            `

            const locationPrices: LocationPrice[] = await sequelize.query(priceQuery, {
                    replacements: { locationIds: locationIds, startDate: startDate, endDate: endDate },
                    type: QueryTypes.SELECT
            })

            // add prices to their respective locations
            locationPrices.forEach(locationPrice => {
                const location = locations.find(location => location.locationId === locationPrice.locationId);
                if (location) {
                    if (!location.locationPrices) {
                        location.locationPrices = [];
                    }
                    location.locationPrices.push(locationPrice);
                }
            })
             

            // go through all locations
            const locationReportPromises = locations.map(async (location) => {

                // create a daily report for each date
                let dailyReports: DailyReport[] = await createDailyReports(startDate, endDate, location)

                // calculate total cost for the location
                const totalCost = dailyReports.reduce((total, report) => total + report.totalDailyCost, 0);

                // create location report
                const locationReport: LocationReport = {
                    location: location,
                    dailyReports: dailyReports,
                    totalCost: totalCost
                }
                
                return locationReport
            })

            const locationReports: LocationReport[] = await Promise.all(locationReportPromises)

            // create return report
            const report: Report = {
                locationReports: locationReports
            }

            return report
        }
    }
}