# Custom Rule: Automated Execution and Iterative Debugging

**Rule Definition:**
Whenever the agent writes new code or fixes an existing bug, the agent MUST independently execute the code/script to verify it works.

**Behavioral Requirements:**
1. Do not ask the user to manually test the code if it can be tested programmatically or via local scripts.
2. If an error is encountered during execution, do not stop or give up. Treat it as a continuous looping instruction.
3. Iteratively debug, patch the code, and re-run the tests until ZERO errors are found.
4. Only return to the user once the code has been proven to execute flawlessly.
