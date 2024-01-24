const generateStateMachine2 = (stages) => {
	const newStepFunction = {
		Comment: "My test workflow state machine",
		StartAt: "stages",
		States: {
			stages: {
				Type: "Parallel",
				End: true,
				Branches: [],
			},
		},
	};
	for (let i = 0; i < stages.length; i++) {
		const currentStageName = Object.keys(stages[i])[0];
		const nextStageName = currentStageName + "-tasks";
		const stage = {
			StartAt: currentStageName,
			States: {},
		};
		stage.States[currentStageName] = {
			Type: "Task",
			Resource:
				"arn:aws:lambda:us-east-1:657907747545:function:workflow-process-lambda:$LATEST",
			Parameters: {
				[`payload.$`]: "$",
				[`stateName.$`]: "$$.State.Name",
			},
			Retry: [
				{
					ErrorEquals: [
						"Lambda.ServiceException",
						"Lambda.AWSLambdaException",
						"Lambda.SdkClientException",
						"Lambda.TooManyRequestsException",
					],
					IntervalSeconds: 1,
					MaxAttempts: 3,
					BackoffRate: 2,
				},
			],
			Next: nextStageName,
			ResultPath: "$",
		};

		const tasks = stages[i][currentStageName].tasks;
		const stageTasksName = `${currentStageName}-tasks`;
		const tasksObjArray = tasks.map((task, index) => {
			return {
				StartAt: currentStageName + "-" + task,
				States: {
					[currentStageName + "-" + task]: {
						Type: "Task",
						Resource:
							"arn:aws:states:::lambda:invoke.waitForTaskToken",
						Parameters: {
							FunctionName: "workflow-parallel-task-lambda",
							Payload: {
								[`executionArn.$`]: "$$.Execution.Id",
								[`token.$`]: "$$.Task.Token",
								[`taskName.$`]: "$$.State.Name",
								[`payload.$`]: "$",
							},
						},
						End: true,
					},
				},
			};
		});

		stage.States[nextStageName] = {
			Type: "Parallel",
			Branches: tasksObjArray,
			End: true,
		};
		newStepFunction.States.stages.Branches.push(stage);
	}
	return newStepFunction;
};

const generateStateMachine1 = (stages) => {
	const newStepFunction = {
		Comment: "My test workflow state machine",
		StartAt: Object.keys(stages[0])[0],
		States: {},
	};
	for (let i = 0; i < stages.length; i++) {
		const currentStageName = Object.keys(stages[i])[0];
		const nextStageName =
			i < stages.length - 1 ? Object.keys(stages[i + 1])[0] : null;
		const tasks = stages[i][currentStageName].tasks;
		const stageTasksName = `${currentStageName}-tasks`;
		const tasksObjArray = tasks.map((task, index) => {
			return {
				StartAt: currentStageName + "-" + task,
				States: {
					[currentStageName + "-" + task]: {
						Type: "Task",
						Resource:
							"arn:aws:states:::lambda:invoke.waitForTaskToken",
						Parameters: {
							FunctionName: "workflow-parallel-task-lambda",
							Payload: {
								[`executionArn.$`]: "$$.Execution.Id",
								[`token.$`]: "$$.Task.Token",
								[`stateName.$`]: "$$.State.Name",
							},
						},
						End: true,
					},
				},
			};
		});
		const paralleState = {
			Type: "Parallel",
			Branches: tasksObjArray,
		};
		if (nextStageName) {
			paralleState.Next = nextStageName;
		} else {
			paralleState.End = true;
		}
		newStepFunction.States[stageTasksName] = paralleState;

		newStepFunction.States[currentStageName] = {
			Type: "Task",
			Resource:
				"arn:aws:lambda:us-east-1:657907747545:function:workflow-process-lambda:$LATEST",
			ResultPath: `$.${currentStageName}Result`,
			Next: stageTasksName,
		};
	}
	return newStepFunction;
};

module.exports = {generateStateMachine2, generateStateMachine1} ;