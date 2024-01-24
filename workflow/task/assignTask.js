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

	const task = JSON.parse(event.body);
	const {
		task_id,
		assigned_to_id,
		assigned_by_id,
		start_date,
		end_date,
		comments,
	} = task;
	const taskUpdate = {
		assigned_by_id: assigned_by_id,
		status: "pending",
		start_date: start_date,
		end_date: end_date,
		comments: comments,
	};
	console.log(taskUpdate);
	await client
		.connect()
		.then(() => {
			console.log("Connected to the database");
		})
		.catch((err) => {
			console.log("Error connecting to the database. Error :" + err);
			return {
				statusCode: 200,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({
					message: "Internal server error : " + err.message,
				}),
			};
		});
	try {
		let query = `
                    update
                        tasks_table 
                    set 
                        assignee_id = $1,
                        task = task || $2
                    where
                        id = $3::uuid`;
		const update = await client.query(query, [
			assigned_to_id,
			JSON.stringify(taskUpdate),
			task_id,
		]);
		if (update.rowCount === 0) {
			return {
				statusCode: 400,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({ message: "No matching records found" }),
			};
		}
		return {
			statusCode: 201,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ message: "task assigned successfully" }),
		};
	} catch (e) {
		console.error("Error:", e);
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ message: "error while assigining task" }),
		};
	} finally {
		await client.end();
	}
};