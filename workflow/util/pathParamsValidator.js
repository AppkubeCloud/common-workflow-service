exports.pathParamsValidator = (schema) => ({
    before: (handler, next) => {
        const { pathParameters } = handler.event;
        if (!pathParameters) {
            throw new Error("Path parameters are missing!");
        }
        const result = schema.safeParse(pathParameters);
        if (!result.success) {
            next(new Error("Invalid path parameters"));
        }
        return next();
    },
});
