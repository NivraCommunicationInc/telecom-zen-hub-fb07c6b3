Admin manages all profiles | cmd=ALL | roles={authenticated} | using=has_role(auth.uid(), 'admin'::app_role) | check=has_role(auth.uid(), 'admin'::app_role)
Client inserts own profile | cmd=INSERT | roles={authenticated} | using=NULL | check=(user_id = auth.uid())
Client reads own profile | cmd=SELECT | roles={authenticated} | using=(user_id = auth.uid()) | check=NULL
Client updates own contact fields | cmd=UPDATE | roles={authenticated} | using=(user_id = auth.uid()) | check=(user_id = auth.uid())
Deny anonymous access to profiles | cmd=ALL | roles={anon} | using=false | check=NULL
Employee reads all profiles | cmd=SELECT | roles={authenticated} | using=has_role(auth.uid(), 'employee'::app_role) | check=NULL
Staff can view all profiles | cmd=SELECT | roles={authenticated} | using=(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role)) | check=NULL
Technician reads profiles | cmd=SELECT | roles={authenticated} | using=has_role(auth.uid(), 'technician'::app_role) | check=NULL
Users can manage own profile | cmd=ALL | roles={authenticated} | using=(id = auth.uid()) | check=(id = auth.uid())
audit_readonly_profiles | cmd=ALL | roles={authenticated} | using=NULL | check=(NOT is_audit_session_active(auth.uid()))
staff_manage_profiles | cmd=ALL | roles={authenticated} | using=(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role)) | check=(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
