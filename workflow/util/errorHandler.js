const {
	UserNotConfirmedException,
	NotAuthorizedException,
    UsernameExistsException
} = require("@aws-sdk/client-cognito-identity-provider");

exports.errorHandler = () => ({
	onError: (handler, next) => {
		if (handler.error instanceof UserNotConfirmedException) {
			handler.response = {
				statusCode: 403,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({
					message: "email not verified",
				}),
			};
			next();
		}
		if (handler.error instanceof NotAuthorizedException) {
			handler.response = {
				statusCode: 401,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({
					message: "Incorrect username or password.",
				}),
			};
			next();
		}
        if (handler.error instanceof UsernameExistsException) {
			handler.response = {
				statusCode: 401,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({
					message: "user already exists.",
				}),
			};
			next();
		}
		handler.response = {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				message: handler.error.message,
				error: handler.error,
			}),
		};
		next();
	},
});
