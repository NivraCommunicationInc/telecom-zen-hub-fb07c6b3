DROP TRIGGER IF EXISTS trg_installation_completed ON technician_assignments;

CREATE TRIGGER trg_installation_completed
AFTER UPDATE OF status ON technician_assignments
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION fn_installation_completed();