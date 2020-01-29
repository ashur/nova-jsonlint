const {JSONLint} = require( "./jsonlint" );

module.exports.activate = async () =>
{
	try
	{
		let jsonlint = new JSONLint();

		/**
		 * Lint all documents as soon as they are opened, and add listeners for
		 * several important lifecycle events.
		 */
		nova.workspace.onDidAddTextEditor( textEditor =>
		{
			jsonlint.lintDocument( textEditor.document );

			textEditor.onDidStopChanging( textEditor =>
			{
				jsonlint.lintDocument( textEditor.document );
			});

			textEditor.document.onDidChangeSyntax( textDocument =>
			{
				jsonlint.lintDocument( textDocument );
			});

			textEditor.onDidDestroy( destroyedTextEditor =>
			{
				// If the backing documents of any other TextEditor instances share
				// the same URI, don't remove the Issues.
				let anotherEditor = nova.workspace.textEditors.find( textEditor =>
				{
					return textEditor.document.uri === destroyedTextEditor.document.uri;
				});

				if( !anotherEditor )
				{
					jsonlint.removeIssues( destroyedTextEditor.document.uri );
				}
			});
		});
	}
	catch( error )
	{
		console.error( error );
	}
}
