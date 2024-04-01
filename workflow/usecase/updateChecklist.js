const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
const middy = require("middy");
const { errorHandler } = require("../util/errorHandler")
const { authorize } = require("../util/authorizer")
const { pathParamsValidator } = require("../util/pathParamsValidator");

const idSchema = z.object({
  id: z.string().uuid({ message: "Invalid employee id" }),
});
exports.handler = middy(async (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const org_id = event.user["custom:org_id"]
    const usecase_id = event.pathParameters.id;
    const uuidSchema = z.string().uuid();
    const isUuid = uuidSchema.safeParse(usecase_id);
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
    const { stage_name, item_id, checked } = JSON.parse(event.body);
    const checklistObj = {
        stage_name: stage_name,
        item_id: item_id,
        checked: checked
    };
    const checklistSchema = z.object({
        stage_name: z.string(),
        item_id: z.number(),
        checked: z.boolean()
    });
    const result = checklistSchema.safeParse(checklistObj);
    if (!result.success) {
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                error: result.error.formErrors.fieldErrors,
            }),
        };
    }
    const client = await connectToDatabase();
    try {
        const query = `
            UPDATE usecases_table
            SET usecase = jsonb_set(
             usecase,
             '{stages,0,"${stage_name}",checklist,${item_id - 1},checked}', 
              $1::jsonb
            )
            WHERE id = $2
            AND org_id = $3
            RETURNING *;
            `;
        const values = [checked, usecase_id, org_id];
        const result = await client.query(query, values);
        const updatedChecklist = result.rows[0]?.usecase?.stages[0]?.[stage_name]?.checklist[item_id - 1];

        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(updatedChecklist),
        };
    } catch (error) {
        console.error('Error updating checklist item:', error);
        return {
            statusCode: 500,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    } finally {
        client.end();
    }
})
    .use(authorize())
    .use(pathParamsValidator(idSchema))
    .use(errorHandler())