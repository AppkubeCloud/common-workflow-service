const { SFNClient, DeleteStateMachineCommand } = require("@aws-sdk/client-sfn");
const { connectToDatabase } = require("../db/dbConnector");
exports.handler = async (event) => {
  const client = await connectToDatabase();
  const workflow_id = event.pathParameters?.id ?? null;
  if (!workflow_id) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Missing workflow_id parameter" }),
    };
  }
  const getarnQuery = `SELECT arn FROM workflows_table WHERE id = $1`;
  const updateStatusQuery = `UPDATE workflows_table
                                SET metadata = jsonb_set(
                                metadata,
                                '{status}',
                                '"terminated"',
                                true
                                ) 
                            WHERE id = $1`;
  await client.query("BEGIN");
  try {
    const result = await client.query(getarnQuery, [workflow_id]);
    const machineArn = result.rows[0].arn;
    const stepFunctionClient = new SFNClient({ region: "us-east-1" });
    const input = {
        stateMachineArn: machineArn,
    };
    const command = new DeleteStateMachineCommand(input);
    const updateResult = await client.query(updateStatusQuery, [workflow_id]);
    if (updateResult.rowCount > 0) {
      const response = await stepFunctionClient.send(command);
      if (response.$metadata.httpStatusCode !== 200) {
        await client.query("ROLLBACK");
      }
    }
    await client.query("COMMIT");
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({message:"workflow sent for deletion and updated workflow status success"}),
    };
  } catch (error) {
    console.error("Error executing query", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  } finally {
    await client.end();
  }
};
