const { connectToDatabase } = require("../db/dbConnector");
const { SFNClient, SendTaskSuccessCommand } = require("@aws-sdk/client-sfn");

exports.handler = async (event) => {
	const task_id = event.queryStringParameters?.task_id ?? null;
	if (task_id == null) {
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				message: "task id is required",
			}),
		};
	}
	const client = await connectToDatabase();
	const updateQuery = `
					update tasks_table 
					set task = jsonb_set(
						task,
						'{status}',
						'"compelted"')
					where id = $1`;
	const getTokenQuery = `
					SELECT 
						token
					FROM 
						tasks_table 
					WHERE
						id = $1`;
	await client.query('BEGIN');
	try {
		const tokenResult = await client.query(getTokenQuery,[task_id]);
		const { token} = tokenResult.rows[0];
        const stepFunctionClient = new SFNClient({region : "us-east-1"});
		const input = {
			output: "1",
			taskToken: token,
		};
        const command = new SendTaskSuccessCommand(input);
		const updateResult = await client.query(updateQuery,[task_id]);
		if(updateResult.rowCount > 0){
			const respone = await stepFunctionClient.send(command)
			if(respone.statusCode !== 200){
				await client.query('ROLLBACK');
			}
		}
		await client.query('COMMIT');
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				message: "task completed",
			}),
		};
	} catch (error) {
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: "Internal Server Error",
				message: error.message,
			}),
		};
	} finally {
		await client.end();
	}
};