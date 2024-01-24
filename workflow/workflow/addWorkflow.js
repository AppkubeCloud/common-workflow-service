const { connectToDatabase } = require("../db/dbConnector");
const { SFNClient, CreateStateMachineCommand } = require("@aws-sdk/client-sfn");
const {generateStateMachine2} = require("./generateStateMachine")

exports.handler = async (event) => {
	const client = await connectToDatabase();
	const requestBody = JSON.parse(event.body);
	const { name, created_by_id, project_id, stages } = requestBody;
	const metaData = {
		created_by_id: created_by_id,
		updated_by_id: created_by_id,
		stages: stages,
	};
	const sfnClient = new SFNClient({ region: "us-east-1" });
	const newStateMachine = generateStateMachine2(stages);
	// console.log(JSON.stringify(newStateMachine))
	const input = {
		name: name,
		definition: JSON.stringify(newStateMachine),
		roleArn: "arn:aws:iam::657907747545:role/backendstepfunc-Role",
	};
	try {
		const command = new CreateStateMachineCommand(input);
		const commandResponse = await sfnClient.send(command);
		console.log(JSON.stringify(commandResponse));
		metaData.created_time = commandResponse.creationDate;
		let query = `
					insert into workflows_table
					(name, arn, metadata, project_id) values ($1, $2, $3::jsonb, $4)
					returning *`;

		const result = await client.query(query, [
			name,
			commandResponse.stateMachineArn,
			metaData,
			project_id,
		]);
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(result.rows[0]),
		};
	} catch (error) {
		console.error("Error updating data:", error);
		if (error.name == "StateMachineAlreadyExists") {
			return {
				statusCode: 500,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({
					error: "Workflow with same name already exists",
				}),
			};
		}
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				message: "Internal Server Error",
				error: error.message,
			}),
		};
	}
};
