import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Employee ID',
      credentials: {
        employeeId: { label: "Employee ID", type: "text", placeholder: "e.g., QHS26270036" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.employeeId || !credentials?.password) {
          return null
        }

        try {
          const employee = await prisma.employee.findFirst({
            where: {
              OR: [
                { id: credentials.employeeId },
                { email: credentials.employeeId },
              ]
            }
          })

          if (!employee || !employee.active) {
            console.warn(`[AUTH] Employee not found or inactive: ${credentials.employeeId}`)
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            employee.hashedPassword
          )

          if (!isPasswordValid) {
            console.warn(`[AUTH] Invalid password for: ${credentials.employeeId}`)
            return null
          }

          return {
            id: employee.id,
            name: employee.name,
            role: employee.role,
            active: employee.active,
          }
        } catch (error) {
          console.error("[AUTH] Error connecting to database or verifying credentials:", error)
          throw error
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.active = user.active
        // Do not store profile images in the JWT. Profile images may be data URLs/base64
        // and can make the NextAuth session cookie exceed browser/server header limits.
      } else if (token.id) {
        const current = await prisma.employee.findUnique({
          where: { id: token.id },
          select: { active: true, role: true }
        })
        token.active = current?.active ?? false
        if (current?.role) token.role = current.role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.active = token.active !== false
      }
      return session
    }
  },
  pages: {
    signIn: '/',
  },
}
