const { SFNClient, StopExecutionCommand } = require("@aws-sdk/client-sfn");
const { z } = require("zod");
const middy = require("middy");
const { errorHandler } = require("../util/errorHandler")
const { authorize } = require("../util/authorizer")
const { pathParamsValidator } = require("../util/pathParamsValidator");
const { connectToDatabase } = require("../db/dbConnector");

const idSchema = z.object({
    id: z.string().uuid({ message: "Invalid employee id" }),
  });

exports.handler = middy(async (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const org_id = event.user["custom:org_id"]
    const usecase_id = event.pathParameters?.id ?? null;
    const usecaseIdSchema = z.string().uuid({ message: "Invalid usecase id" });
    const isUuid = usecaseIdSchema.safeParse(usecase_id);
    if (!isUuid.success) {
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                error: isUuid.error.issues[0].message,
            }),
        };
    }
    const client = await connectToDatabase();
    const stopdate = new Date().toISOString();
    const stop_date = JSON.stringify(stopdate);
    const sfnClient = new SFNClient({ region: "us-east-1" });
    const getarnQuery = `SELECT arn FROM usecases_table WHERE id = $1`;
    const updateStatusQuery = `   UPDATE usecases_table
                                SET usecase = jsonb_set(
                                  jsonb_set(
                                    usecase,
                                    '{status}',
                                    '"Stop"',
                                    true
                                  ),
                                  '{stop_date}',
                                  $2::jsonb,
                                  true
                                )
                                WHERE id = $1
                                AND org_id = $2`;
    await client.query("BEGIN");
        const result = await client.query(getarnQuery, [usecase_id, org_id]);
        executionArn = result.rows[0].arn;
        const input = {
            executionArn: executionArn,
        };
        const command = new StopExecutionCommand(input);
        const updateResult = await client.query(updateStatusQuery, [
            usecase_id,
            stop_date,
        ]);
        if (updateResult.rowCount > 0) {
            const response = await sfnClient.send(command);
            if (response.$metadata.httpStatusCode !== 200) {
                await client.query("ROLLBACK");
            }
        }
        await client.query("COMMIT");
        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify("usecase data updated successfully"),
        };
})
    .use(authorize())
    .use(pathParamsValidator(idSchema))
    .use(errorHandler())
