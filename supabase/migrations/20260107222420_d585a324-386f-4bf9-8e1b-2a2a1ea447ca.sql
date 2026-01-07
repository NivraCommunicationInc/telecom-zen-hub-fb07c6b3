-- Drop all RLS policies for helpdesk_messages
DROP POLICY IF EXISTS "Clients can send messages in their conversations" ON public.helpdesk_messages;
DROP POLICY IF EXISTS "Clients can view messages in their conversations" ON public.helpdesk_messages;
DROP POLICY IF EXISTS "Staff can send messages" ON public.helpdesk_messages;
DROP POLICY IF EXISTS "Staff can view all messages" ON public.helpdesk_messages;

-- Drop all RLS policies for message_conversations
DROP POLICY IF EXISTS "Clients can create conversations" ON public.message_conversations;
DROP POLICY IF EXISTS "Clients can update their own conversations" ON public.message_conversations;
DROP POLICY IF EXISTS "Clients can view their own conversations" ON public.message_conversations;
DROP POLICY IF EXISTS "Staff can update conversations" ON public.message_conversations;
DROP POLICY IF EXISTS "Staff can view all conversations" ON public.message_conversations;

-- Drop the tables (helpdesk_messages first due to FK)
DROP TABLE IF EXISTS public.helpdesk_messages;
DROP TABLE IF EXISTS public.message_conversations;