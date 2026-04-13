import { supabase } from './supabase'

export async function getActivePeriod() {
  const { data, error } = await supabase
    .from('periods')
    .select('*')
    .eq('is_active', true)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getParticipants() {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getPaymentsByPeriod(periodId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('period_id', periodId)

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function ensurePaymentsForPeriod(periodId, participants) {
  if (!participants.length) {
    return
  }

  const payload = participants.map((participant) => ({
    participant_id: participant.id,
    period_id: periodId,
    status: 'unpaid',
    amount: 0,
  }))

  const { error } = await supabase
    .from('payments')
    .upsert(payload, { onConflict: 'participant_id,period_id', ignoreDuplicates: true })

  if (error) {
    throw new Error(error.message)
  }
}

export async function createParticipant(name, activePeriodId) {
  const { data, error } = await supabase
    .from('participants')
    .insert({ name: name.trim() })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (activePeriodId) {
    const { error: paymentError } = await supabase
      .from('payments')
      .upsert(
        {
          participant_id: data.id,
          period_id: activePeriodId,
          status: 'unpaid',
          amount: 0,
        },
        { onConflict: 'participant_id,period_id' },
      )

    if (paymentError) {
      throw new Error(paymentError.message)
    }
  }

  return data
}

export async function deleteParticipant(participantId) {
  const { error } = await supabase.from('participants').delete().eq('id', participantId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function updatePayment(paymentId, status, amount) {
  const { error } = await supabase
    .from('payments')
    .update({
      status,
      amount: Number(amount) || 0,
    })
    .eq('id', paymentId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateWinner(periodId, winnerName) {
  const { error } = await supabase
    .from('periods')
    .update({ winner_name: winnerName.trim() })
    .eq('id', periodId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function updatePeriodLabel(periodId, label) {
  const { error } = await supabase
    .from('periods')
    .update({ label: label.trim() })
    .eq('id', periodId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function signInAdmin(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    throw new Error(error.message)
  }
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  return data.session
}

export async function isCurrentUserAdmin() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    throw new Error(authError.message)
  }

  if (!user) {
    return false
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return Boolean(data)
}
