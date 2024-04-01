exports.bodyValidator = (schema) => ({
	before: (handler, next) => {
		const { body } = handler.event;
		if (!body) {
			throw new Error("empty request body!");
		}
		const data = JSON.parse(body);
		const result = schema.safeParse(data);
		if (!result.success) {
            next(new Error("invalid request body"));
		}
		return next();
	},
});
