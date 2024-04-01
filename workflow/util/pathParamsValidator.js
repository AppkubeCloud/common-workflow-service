exports.pathParamsValidator = schema => ({
	before: (handler) => {
		const { pathParameters } = handler.event
		if (!pathParameters) {
			throw new Error("Path parameters are missing!")
		}
		const result = schema.safeParse(pathParameters)
		if (!result.success) {
			throw new Error("Invalid path parameters")
		}
	},
})