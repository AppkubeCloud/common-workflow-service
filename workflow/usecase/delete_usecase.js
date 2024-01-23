const { connectToDatabase } = require("../db/dbConnector");
const { SFNClient, StopExecutionCommand } = require("@aws-sdk/client-sfn");
const sfnClient = new SFNClient();

exports.handler = async (event) => {
    const usecase_id = event.queryStringParameters ?.usecase_id ?? null;
	if ( usecase_id == null || usecase_id == '') {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: "The 'usecase_id' query parameters are required and must have a non-empty value."
                }),
        };
    }
    const client = await connectToDatabase();

    try {

        const query = `
      WITH deleted_rows AS (
        DELETE FROM tasks_table
        WHERE usecase_id = $1
        RETURNING *
      )
      DELETE FROM usecases_table
      WHERE id = $1
      RETURNING *;
    `;

    const result = await client.query(query, [usecase_id]);
    
    const executionArn = result.rows[0].arn;

    const input = {
        executionArn: executionArn,
      };
      const command = new StopExecutionCommand(input);
      const response = await sfnClient.send(command);

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
              },
            body: JSON.stringify({ message: 'Execution stopped, Rows deleted successfully' }),
        };
    } catch (error) {
        console.error('Error executing query', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
              },
            body: JSON.stringify({ message: 'Internal server error' }),
            error: error.message,
        };
    } finally {
        await client.end();
    }
};