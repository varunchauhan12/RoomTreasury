export const aiSchema = `CREATE TABLE proposal_ai_results (
 proposal_id TEXT PRIMARY KEY NOT NULL REFERENCES delivery_proposals(id),
 provider TEXT NOT NULL CHECK(provider='openai'), model TEXT NOT NULL CHECK(length(model)>0),
 response_id TEXT NOT NULL CHECK(length(response_id)>0),
 assumptions TEXT NOT NULL CHECK(json_valid(assumptions) AND json_type(assumptions)='array'),
 risks TEXT NOT NULL CHECK(json_valid(risks) AND json_type(risks)='array')
) STRICT;
CREATE TRIGGER ai_result_binding BEFORE INSERT ON proposal_ai_results WHEN NOT EXISTS(SELECT 1 FROM delivery_proposals WHERE id=NEW.proposal_id AND provenance='ai' AND status='pending') BEGIN SELECT RAISE(ABORT,'invalid AI provenance'); END;
CREATE TRIGGER ai_result_no_update BEFORE UPDATE ON proposal_ai_results BEGIN SELECT RAISE(ABORT,'immutable AI provenance'); END;
CREATE TRIGGER ai_result_no_delete BEFORE DELETE ON proposal_ai_results BEGIN SELECT RAISE(ABORT,'immutable AI provenance'); END;`;
