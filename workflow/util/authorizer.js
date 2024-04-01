const jwt = require("jsonwebtoken")
const jwksClient = require("jwks-rsa")
const cognitoIssuer = `https://cognito-idp.us-east-1.amazonaws.com/${process.env.COGNITO_POOL_ID}`
const client = jwksClient({
  jwksUri: `${cognitoIssuer}/.well-known/jwks.json`,
})

class AuthorizationError extends Error {
  constructor(message) {
    super(message)
    this.name = "AuthorizationError"
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor)
    } else {
      this.stack = new Error(message).stack
    }
  }
}

async function validateToken(token) {
  const decodedToken = jwt.decode(token, { complete: true, json: true })
  const key = await client.getSigningKey(decodedToken.header.kid)
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      key.getPublicKey(),
      { issuer: cognitoIssuer },
      (err, decoded) => {
        if (err) {
          reject(err)
        } else {
          resolve(decoded)
        }
      }
    )
  })
}

const authorize = () => ({
  before: async (handler) => {
    const { event } = handler
    const authHeader = event.headers.Authorization ?? null
    if (!authHeader) {
      throw new AuthorizationError("no authorization header provided")
    }
    if (!authHeader.startsWith("Bearer ")) {
      throw new AuthorizationError("invalid authorization header format")
    }
    const token = authHeader.substring(7)
    const userData = await validateToken(token)
    handler.event.user = userData
  },
})

module.exports = {
  AuthorizationError,
  authorize,
}