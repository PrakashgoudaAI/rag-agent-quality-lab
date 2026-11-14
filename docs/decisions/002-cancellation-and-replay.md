# Cancellation is not a transaction rollback

The MCP client passes an AbortSignal to its request. The SDK sends a cancellation notification, and the server handler receives its own signal. Host-owned lifecycle hooks let tests pause immediately before or after the in-memory write; callers cannot choose those hooks through tool arguments.

Before commit, the handler checks cancellation after any asynchronous storage pause and before mutating the map. The in-flight cancellation test waits for the handler to start, cancels the client request, observes cancellation at the server and then releases the pause. No record is written and the runner does not dispatch its next action. A separate deadline test exercises the same boundary without a caller abort.

After commit, cancellation can prevent the caller from seeing the result while the record remains. The test pauses after writing, cancels, then repeats the same request key and payload. It recovers the original record without a second effect; changing the payload conflicts. The action runner never retries automatically.

This demonstrates one process and an in-memory repository through the SDK's linked transports. It does not prove network delivery, remote service cancellation, durability or coordination between replicas. A production write needs durable replay state and an explicit reconciliation procedure for uncertain outcomes.

The protocol allows cancellation to race with completion. The implementation follows the [MCP cancellation rules](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation), rather than treating a cancelled client promise as evidence that nothing happened.
