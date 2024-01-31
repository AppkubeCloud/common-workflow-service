const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {
	const status = event.queryStringParameters?.status ?? null;
	const validStatusValues = ["unassigned", "comlpeted", "inprogress"]
	const statusSchema = z.string().refine((value) => validStatusValues.includes(value), {
		message: "Invalid status value",
	  }); 
	const isValidStatus = statusSchema.safeParse(status)
	if(!isValidStatus.success){
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: isValidStatus.error.issues[0].message
			}),
		};
	}
    const client = await connectToDatabase();
	try {
		let query = `
                    select 
                        p.id as project_id,
                        p.project->>'name' as proejct_name,
                        p.project->>'project_icon_url' as project_icon_url,
                        p.project->>'status' as status,
                        p.project->'team'->'roles' as roles,
                        COUNT(u.id) as total_usecases
                    from 
                        projects_table as p
                    left join 
                        usecases_table as u on p.id = u.project_id`;
		let queryparams = [];
		if (status != null) {
			query += `
                    where 
                        p.project->>'status' = $1`;
			queryparams.push(status);
		}
		query += `
                    group by
                        p.id`;
		const result = await client.query(query, queryparams);
		const response = result.rows.map(
			({
				project_id,
				proejct_name,
				project_icon_url,
				status,
				roles,
				total_usecases,
			}) => {
				let res = roles?.map((e) => Object.values(e)).flat();
				return {
					id: project_id,
					name: proejct_name,
					icon_url: project_icon_url,
					status,
					total_resources: new Set(res?.flat()).size,
					total_usecases: parseInt(total_usecases),
				};
			}
		);
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(response),
		};
	} catch (error) {
		console.error("Error executing query:", error);
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ message: "Internal Server Error" }),
		};
	} finally {
		await client.end();
	}
};
