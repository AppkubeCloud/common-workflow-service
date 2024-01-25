const { Client } = require("pg");


async function connectToDatabase() {
	try {
		const secretsManagerClient = new SecretsManagerClient({
			region: "us-east-1",
		});
		const configuration = await secretsManagerClient.send(
			new GetSecretValueCommand({
				SecretId: "serverless/lambda/credintials",
			})
		);
		const dbConfig = JSON.parse(configuration.SecretString);
		const client = new Client({
			host: dbConfig.host,
			port: dbConfig.port,
			database: "workflow",
			user: dbConfig.engine,
			password: dbConfig.password,
		});
		await client.connect();
		return client;
	} catch (err) {
		console.log("error :" + err.message);
		throw err;
	}
}

module.exports = {
	connectToDatabase,
};
