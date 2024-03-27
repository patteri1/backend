import bcrypt from 'bcrypt'
import { Sequelize } from "sequelize";
import { User, UserRole } from "../model";

const sequelize = new Sequelize("postgres://postgres@localhost:5432/postgres", {
    define: {
        freezeTableName: true
    }
})

const connectToDatabase = async () => {
    try {
        await sequelize.authenticate()
        console.log("Database connection OK")
    } catch (error) {
        console.log("Database connection failed")
        return process.exit(1)
    }

    return null
}

const initializeRoles = async () => {
    const roles: string[] = ['admin', 'transport', 'processing']

    try {
        for (const roleName of roles) {
            await UserRole.findOrCreate({
                where: { roleName: roleName },
                defaults: { roleName: roleName },
            })
        }

    } catch (error) {
        console.error('Error initializing roles:', error);
    }
}

const initializeAdminUser = async () => {
    const adminUsername: string = process.env.ADMIN_USERNAME!
    const adminPassword: string = process.env.ADMIN_PASSWORD!

    // Hash the password
	const saltRounds: number = 10
	const adminPasswordHash: string = await bcrypt.hash(adminPassword, saltRounds)

    const userUsername: string = process.env.USER_USERNAME!
    const userPassword: string = process.env.USER_PASSWORD!

    // Hash the password

	const userPasswordHash: string = await bcrypt.hash(userPassword, saltRounds)


    try {
        await User.findOrCreate({
            where: { username: adminUsername },
            defaults: { username: adminUsername, passwordHash: adminPasswordHash, userRoleId: 1 },
        })
        await User.findOrCreate({
            where: { username: userUsername },
            defaults: { username: userUsername, passwordHash: userPasswordHash, userRoleId: 2 },
        })

    } catch (error) {
        console.error('Error initialising the admin user:', error);
    }
}

export { connectToDatabase, initializeRoles,initializeAdminUser, sequelize }