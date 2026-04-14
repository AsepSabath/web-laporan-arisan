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

export async function getPeriods() {
  const { data, error } = await supabase
    .from('periods')
    .select('*')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createPeriod({ label, winnerName = '' }) {
  const { data, error } = await supabase
    .from('periods')
    .insert({
      label: label.trim(),
      winner_name: winnerName.trim() || 'Belum ditentukan',
      is_active: false,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function activatePeriod(periodId) {
  const { error: deactivateError } = await supabase
    .from('periods')
    .update({ is_active: false })
    .eq('is_active', true)

  if (deactivateError) {
    throw new Error(deactivateError.message)
  }

  const { error: activateError } = await supabase
    .from('periods')
    .update({ is_active: true })
    .eq('id', periodId)

  if (activateError) {
    throw new Error(activateError.message)
  }
}

export async function getParticipants() {
  const orderedQuery = await supabase
    .from('participants')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  // Backward-compatible fallback if sort_order column is not available yet.
  if (orderedQuery.error) {
    const fallbackQuery = await supabase
      .from('participants')
      .select('*')
      .order('name', { ascending: true })

    if (fallbackQuery.error) {
      throw new Error(fallbackQuery.error.message)
    }

    return fallbackQuery.data
  }

  return orderedQuery.data
}

export async function updateParticipantsOrder(participantIds) {
  if (!participantIds.length) {
    return
  }

  // Phase 1: move all selected rows to a high temporary range to avoid unique clashes.
  const tempOffset = 100000
  const tempUpdates = participantIds.map((participantId, index) =>
    supabase
      .from('participants')
      .update({ sort_order: tempOffset + index + 1 })
      .eq('id', participantId),
  )

  const tempResults = await Promise.all(tempUpdates)
  const tempFailed = tempResults.find((result) => result.error)
  if (tempFailed?.error) {
    throw new Error(tempFailed.error.message)
  }

  // Phase 2: write the final normalized 1..N ordering.
  const finalUpdates = participantIds.map((participantId, index) =>
    supabase
      .from('participants')
      .update({ sort_order: index + 1 })
      .eq('id', participantId),
  )

  const finalResults = await Promise.all(finalUpdates)
  const finalFailed = finalResults.find((result) => result.error)
  if (finalFailed?.error) {
    throw new Error(finalFailed.error.message)
  }
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
  let nextSortOrder = null

  const lastOrderQuery = await supabase
    .from('participants')
    .select('sort_order')
    .not('sort_order', 'is', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastOrderQuery.error) {
    nextSortOrder = Number(lastOrderQuery.data?.sort_order || 0) + 1
  }

  const insertPayload = {
    name: name.trim(),
  }

  if (nextSortOrder !== null) {
    insertPayload.sort_order = nextSortOrder
  }

  const { data, error } = await supabase
    .from('participants')
    .insert(insertPayload)
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
