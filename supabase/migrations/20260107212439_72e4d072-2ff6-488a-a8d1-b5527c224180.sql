-- =====================================================
-- FEATURE 5: Internal Messaging System (Helpdesk)
-- =====================================================

-- Conversations table (threads)
CREATE TABLE IF NOT EXISTS public.message_conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by_id UUID,
    closed_by_name TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    unread_by_client BOOLEAN DEFAULT false,
    unread_by_admin BOOLEAN DEFAULT true
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.helpdesk_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.message_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    content TEXT NOT NULL,
    is_internal_note BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_message_conversations_client ON public.message_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_message_conversations_status ON public.message_conversations(status);
CREATE INDEX IF NOT EXISTS idx_helpdesk_messages_conversation ON public.helpdesk_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_messages_created ON public.helpdesk_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.message_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_conversations
CREATE POLICY "Clients can view their own conversations"
    ON public.message_conversations FOR SELECT
    USING (auth.uid() = client_id);

CREATE POLICY "Clients can create conversations"
    ON public.message_conversations FOR INSERT
    WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update their own conversations"
    ON public.message_conversations FOR UPDATE
    USING (auth.uid() = client_id);

-- RLS Policies for helpdesk_messages
CREATE POLICY "Clients can view messages in their conversations"
    ON public.helpdesk_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.message_conversations mc
            WHERE mc.id = helpdesk_messages.conversation_id
            AND mc.client_id = auth.uid()
        )
        AND is_internal_note = false
    );

CREATE POLICY "Clients can send messages in their conversations"
    ON public.helpdesk_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.message_conversations mc
            WHERE mc.id = helpdesk_messages.conversation_id
            AND mc.client_id = auth.uid()
        )
        AND sender_role = 'client'
    );

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.helpdesk_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_conversations;