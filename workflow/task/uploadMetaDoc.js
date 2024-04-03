const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {

    const task_id = event.pathParameters?.taskId;
    const uuidSchema = z.string().uuid();
    const isUuid = uuidSchema.safeParse(task_id);
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
    const { doc_name, doc_url, type } = JSON.parse(event.body);
    const currentTimestamp = new Date().toISOString();
    const createdBy = "13a7d5ff-64c2-4a6f-87da-82e5fb78ce8f";
    const metadocsObj = {
        doc_name: doc_name,
        doc_url: doc_url,
        type: type
    };
    const metadocsSchema = z.object({
        doc_name: z.string(),
        doc_url: z.string().url({
            message : "invalid string"
        }),
        type: z.string().min(3, { message: "type must be atleast 3 characters" }),
    });
    const result = metadocsSchema.safeParse(metadocsObj);
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

        let query = `
					insert into metadocs_table
					(tasks_id, created_by, doc_name, doc_url, created_time, type) values ($1, $2, $3, $4, $5, $6)
					returning *`;
        let queryparam = [
            task_id,
            createdBy,
            doc_name,
            doc_url,
            currentTimestamp,
            type
        ];
        const result = await client.query(query, queryparam);
        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(result.rows[0]),
        };
    } catch (error) {
        console.error("Error inserting data:", error);
        return {
            statusCode: 500,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                message: error.message,
                error: error,
            }),
        };
    } finally {
        await client.end();
    }
};