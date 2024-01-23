const { Client } = require("pg");
const {
	SecretsManagerClient,
	GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

exports.handler = async (event) => {
	const secretsManagerClient = new SecretsManagerClient({
		region: "us-east-1",
	});
	const configuration = await secretsManagerClient.send(
		new GetSecretValueCommand({ SecretId: "serverless/lambda/credintials" })
	);
	const dbConfig = JSON.parse(configuration.SecretString);
	const client = new Client({
		host: dbConfig.host,
		port: dbConfig.port,
		database: "workflow",
		user: dbConfig.engine,
		password: dbConfig.password,
	});
	const requestBody = JSON.parse(event.body);
	const {
		usecase_id,
		stage_name,
		assigned_to_id,
		assigned_by_id,
		updated_by_id,
		description,
	} = requestBody;

	try {
		await client
			.connect()
			.then(() => {
				console.log("Connected to the database");
			})
			.catch((err) => {
				console.log("Error connecting to the database. Error :" + err);
			});

		const result = await client.query(
			"SELECT usecase FROM usecases_table WHERE id = $1",
			[usecase_id]
		);
        if ( result.rowCount === 0) {
			return {
				statusCode: 400,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({ message: "Usecase not found" })
			};
		}
		const existingData = result.rows[0].usecase;
		const updatedWorkflow = existingData.workflow.map((stage) => {
			if (stage[stage_name]) {
				console.log(stage[stage_name]);
				console.log(stage);
				stage[stage_name].assignee_id = assigned_to_id;
				if (!stage[stage_name].assigned_by_id)
					stage[stage_name].assigned_by_id = assigned_by_id;
				if (!stage[stage_name].updated_by_id)
					stage[stage_name].updated_by_id = updated_by_id;
				if (!stage[stage_name].description)
					stage[stage_name].description = description;
			}
			return stage;
		});

		await client.query(`
                            UPDATE usecases_table
                            SET usecase = $1 WHERE id = $2`,
			[Object.assign({}, existingData, { workflow: updatedWorkflow }),
			usecase_id,]
		);

		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ message: "Stage assigned successfully" }),
		};
	} catch (error) {
		console.error("error", error);
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ message: "Error While assigning" }),
		};
	} finally {
		await client.end();
	}
};
