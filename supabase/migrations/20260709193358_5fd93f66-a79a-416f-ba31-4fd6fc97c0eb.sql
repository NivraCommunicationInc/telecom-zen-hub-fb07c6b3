DO $$
DECLARE
  qa_user uuid := 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
  qa_actor uuid := 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
  ma_id uuid; ta_id uuid;
BEGIN
  INSERT INTO internet_modem_actions(user_id, action_type, status, reason, performed_by, modem_serial, metadata)
  VALUES (qa_user,'reboot','completed','QA E2E Module 19 — reboot modem',qa_actor,'QA-MODEM-01', jsonb_build_object('simulated',true,'idempotency_key','qa-m19-modem'))
  RETURNING id INTO ma_id;
  INSERT INTO admin_audit_log(admin_user_id, action, target_type, target_id, details)
  VALUES (qa_actor,'modem_action','internet_modem_action',ma_id, jsonb_build_object('action_type','reboot','modem_serial','QA-MODEM-01','simulated',true));
  INSERT INTO client_activity_logs(client_id, actor_user_id, actor_name, actor_role, action_type, entity_type, entity_id, summary, after_data)
  VALUES (qa_user,qa_actor,'QA Bot','admin','equipment_change','equipment',ma_id,'Modem: Redémarrage du modem · S/N QA-MODEM-01', jsonb_build_object('action_type','reboot','modem_serial','QA-MODEM-01'));
  INSERT INTO client_internal_notes(client_id, note_type, body, created_by_user_id, created_by_role, created_by_name)
  VALUES (qa_user,'admin','[INTERNET] Redémarrage du modem · S/N QA-MODEM-01 · Raison: QA E2E Module 19',qa_actor,'admin','QA Bot');
  INSERT INTO email_queue(to_email, subject, template_key, template_vars, status, priority, language)
  VALUES ('test-c360-planchange-v2@nivra-test.ca','Redémarrage équipement en cours','client_internet_modem_action',
          jsonb_build_object('action_label','Redémarrage du modem','modem_serial','QA-MODEM-01','reason','QA E2E Module 19'),'queued',5,'fr');

  INSERT INTO tv_terminal_actions(user_id, action_type, status, reason, performed_by, terminal_serial, metadata)
  VALUES (qa_user,'reboot','completed','QA E2E Module 19 — reboot terminal TV',qa_actor,'QA-TERM-01', jsonb_build_object('simulated',true,'idempotency_key','qa-m19-terminal'))
  RETURNING id INTO ta_id;
  INSERT INTO admin_audit_log(admin_user_id, action, target_type, target_id, details)
  VALUES (qa_actor,'terminal_action','tv_terminal_action',ta_id, jsonb_build_object('action_type','reboot','terminal_serial','QA-TERM-01','simulated',true));
  INSERT INTO client_activity_logs(client_id, actor_user_id, actor_name, actor_role, action_type, entity_type, entity_id, summary, after_data)
  VALUES (qa_user,qa_actor,'QA Bot','admin','equipment_change','equipment',ta_id,'Redémarrage du terminal TV (SN QA-TERM-01)', jsonb_build_object('action_type','reboot','terminal_serial','QA-TERM-01'));
  INSERT INTO client_internal_notes(client_id, note_type, body, created_by_user_id, created_by_role, created_by_name)
  VALUES (qa_user,'admin','[TV] Redémarrage du terminal TV — SN QA-TERM-01. Motif: QA E2E Module 19',qa_actor,'admin','QA Bot');
  INSERT INTO email_queue(to_email, subject, template_key, template_vars, status, priority, language)
  VALUES ('test-c360-planchange-v2@nivra-test.ca','Redémarrage terminal TV en cours','client_tv_terminal_action',
          jsonb_build_object('action_label','Redémarrage du terminal TV','terminal_serial','QA-TERM-01','reason','QA E2E Module 19'),'queued',5,'fr');
END $$;