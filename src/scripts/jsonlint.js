const {NPMExecutable} = require( "nova-npm-executable" );

/** Class that provides linting support via external JSONLint executable */
module.exports.JSONLint = class JSONLint
{
	constructor()
	{
		this.jsonlint = new NPMExecutable( "jsonlint" );
		if( !this.jsonlint.isInstalled )
		{
			this.jsonlint.install()
				.catch( error =>
				{
					console.error( error );
				});
		}

		this._isNpxInstalled = null;
		this.didNotify = false;

		this.issueCollection = new IssueCollection();
	}

	/**
	 * Returns whether `npx` can be found on $PATH
	 *
	 * @return {Promise<boolean>}
	 */
	get isNpxInstalled()
	{
		if( this._isNpxInstalled )
		{
			return Promise.resolve( true );
		}

		return new Promise( resolve =>
		{
			let env = new Process( "/usr/bin/env", { args: ["which", "npx"], shell: true } );
			env.onDidExit( status =>
			{
				this._isNpxInstalled = status === 0;
				resolve( this._isNpxInstalled );
			});
			env.start();
		});
	}

	/**
	 * Lint a document's contents
	 *
	 * @return {Promise}
	 */
	async lintDocument( textDocument )
	{
		let isNpxInstalled = await this.isNpxInstalled;

		if( !isNpxInstalled && !this.didNotify )
		{
			this.didNotify = true;

			let request = new NotificationRequest( "ashur.JSONLint.npxNotFound" );
			request.title = "NPM Not Found";
			request.body = "JSONLint requires NPM and Node.js. Please download and install the latest version of Node.js, or verify that NPM can be found on $PATH.";
			request.actions = ["OK", "Help"];

			try
			{
				let response = await nova.notifications.add( request );
				if( response.actionIdx === 1 )
				{
					nova.openConfig();
				}
			}
			catch( error )
			{
				console.error( error );
			}
		}

		if( textDocument.syntax !== "json" )
		{
			return;
		}

		let range = new Range( 0, textDocument.length );
		let contents = textDocument.getTextInRange( range );

		return this.lintString( contents, textDocument.uri );
	}

	/**
	 * Write a string to the JSONLint process's STDIN, then parse output and
	 * pass results to reporter.
	 *
	 * @param {String} string
	 * @param {String} fileURI
	 * @see parseOutput
	 * @see report
	 * @return {Promise}
	 */
	async lintString( string, fileURI )
	{
		try
		{
			// Equivalent to running `echo <string> | npx jsonlint -c`
			let process = await this.jsonlint.process( { args: ["-c"] } );

			let output = "";
			process.onStdout( line => output += line.trimRight() );
			process.onStderr( line => output += line.trimRight() );
			process.onDidExit( status =>
			{
				let results = status === 0 ? [] : this.parseOutput( output );

				// We need to report all documents, regardless of whether JSONLint
				// reported any problems. Otherwise, fixing a problem in the
				// document doesn't clear the Issue.
				this.report( results, fileURI );
			});

			process.start();

			let writer = process.stdin.getWriter();
			writer.write( string );
			writer.close();
		}
		catch( error )
		{
			console.error( error )
		}
	}

	/**
	 * Parse a string for JSONLint error output
	 *
	 * @return {[Object]} Array of objects describing results
	 */
	parseOutput( string )
	{
		let results = [];

		// JSONLint only reports one issue at a time, so there's no need to
		// perform a global match.
		let pattern = /line (\d+), col (\d+), found: '([^']+)' - expected: '([^']+)'/;
		let matches = string.match( pattern );

		if( matches )
		{
			results.push({
				line: matches[1],
				column: matches[2],
				found: matches[3],
				expected: matches[4],
			});
		}

		return results;
	}

	/**
	 * @param {String} fileURI
	 */
	removeIssues( fileURI )
	{
		this.issueCollection.remove( fileURI );
	}

	/**
	 * Convert parsed JSONLint output into Nova issues
	 *
	 * @param {[Object]} results
	 * @param {String} fileURI
	 */
	report( results, fileURI )
	{
		let issues = results.map( result =>
		{
			let issue = new Issue();
			issue.message = `Found ${JSON.stringify( result.found )}; Expected ${result.expected}`;
			issue.severity = IssueSeverity.Error;
			issue.line = result.line;
			issue.column = parseInt( result.column ) + 1;

			return issue;
		});

		this.issueCollection.set( fileURI, issues );
	}
}
