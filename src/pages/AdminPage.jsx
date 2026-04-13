import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createParticipant,
  deleteParticipant,
  ensurePaymentsForPeriod,
  getActivePeriod,
  getCurrentSession,
  getParticipants,
  getPaymentsByPeriod,
  isCurrentUserAdmin,
  signInAdmin,
  signOutAdmin,
  updatePeriodLabel,
  updatePayment,
  updateParticipantsOrder,
  updateWinner,
} from '../lib/api'

function currency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function parseRangeFromLabel(label) {
  const match = String(label || '')
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/)

  if (!match) {
    return { startDate: '', endDate: '' }
  }

  return { startDate: match[1], endDate: match[2] }
}

function formatLabelFromDates(startDate, endDate) {
  return `${startDate} - ${endDate}`
}

function readablePeriodLabel(label) {
  const { startDate, endDate } = parseRangeFromLabel(label)

  if (!startDate || !endDate) {
    return label || '-'
  }

  const formatter = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`
}

function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [period, setPeriod] = useState(null)
  const [participants, setParticipants] = useState([])
  const [payments, setPayments] = useState([])
  const [newParticipant, setNewParticipant] = useState('')
  const [winnerName, setWinnerName] = useState('')
  const [periodStartDate, setPeriodStartDate] = useState('')
  const [periodEndDate, setPeriodEndDate] = useState('')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })

  useEffect(() => {
    initSession()
  }, [])

  async function initSession() {
    try {
      setLoading(true)
      setError('')
      const session = await getCurrentSession()

      if (!session) {
        setSessionReady(true)
        setIsAdmin(false)
        return
      }

      const adminRole = await isCurrentUserAdmin()
      setIsAdmin(adminRole)
      setSessionReady(true)

      if (adminRole) {
        await loadAdminData()
      }
    } catch (err) {
      setError(err.message || 'Gagal cek session admin')
    } finally {
      setLoading(false)
    }
  }

  async function loadAdminData() {
    const [activePeriod, participantRows] = await Promise.all([
      getActivePeriod(),
      getParticipants(),
    ])

    await ensurePaymentsForPeriod(activePeriod.id, participantRows)

    const paymentRows = await getPaymentsByPeriod(activePeriod.id)

    setPeriod(activePeriod)
    setWinnerName(activePeriod.winner_name || '')
    const { startDate, endDate } = parseRangeFromLabel(activePeriod.label)
    setPeriodStartDate(startDate)
    setPeriodEndDate(endDate)
    setParticipants(participantRows)
    setPayments(paymentRows)
  }

  const paymentRows = useMemo(() => {
    const paymentMap = new Map(payments.map((item) => [item.participant_id, item]))

    return participants.map((participant) => {
      const payment = paymentMap.get(participant.id)
      return {
        participant,
        payment,
      }
    })
  }, [participants, payments])

  async function onLogin(event) {
    event.preventDefault()

    try {
      setSaving(true)
      setError('')
      await signInAdmin(loginForm.email, loginForm.password)

      const adminRole = await isCurrentUserAdmin()
      if (!adminRole) {
        await signOutAdmin()
        throw new Error('Akun ini bukan admin.')
      }

      setIsAdmin(true)
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Login admin gagal')
    } finally {
      setSaving(false)
    }
  }

  async function onLogout() {
    try {
      setSaving(true)
      setError('')
      await signOutAdmin()
      setIsAdmin(false)
      setParticipants([])
      setPayments([])
    } catch (err) {
      setError(err.message || 'Gagal logout')
    } finally {
      setSaving(false)
    }
  }

  async function onAddParticipant(event) {
    event.preventDefault()

    if (!newParticipant.trim() || !period?.id) {
      return
    }

    try {
      setSaving(true)
      setError('')
      await createParticipant(newParticipant, period.id)
      setNewParticipant('')
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Gagal menambah peserta')
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteParticipant(participantId) {
    try {
      setSaving(true)
      setError('')
      await deleteParticipant(participantId)
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Gagal menghapus peserta')
    } finally {
      setSaving(false)
    }
  }

  async function onUpdatePayment(paymentId, status, amount) {
    try {
      setSaving(true)
      setError('')
      await updatePayment(paymentId, status, amount)
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Gagal update pembayaran')
    } finally {
      setSaving(false)
    }
  }

  async function onUpdateWinner(event) {
    event.preventDefault()

    if (!period?.id) {
      return
    }

    try {
      setSaving(true)
      setError('')
      await updateWinner(period.id, winnerName)
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Gagal update pemenang')
    } finally {
      setSaving(false)
    }
  }

  async function onMoveParticipant(participantId, direction) {
    const currentIndex = participants.findIndex((participant) => participant.id === participantId)

    if (currentIndex === -1) {
      return
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= participants.length) {
      return
    }

    const reordered = [...participants]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    try {
      setSaving(true)
      setError('')
      await updateParticipantsOrder(reordered.map((participant) => participant.id))
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Gagal mengubah urutan peserta')
    } finally {
      setSaving(false)
    }
  }

  async function onUpdatePeriodDate(event) {
    event.preventDefault()

    if (!period?.id || !periodStartDate || !periodEndDate) {
      return
    }

    if (periodStartDate > periodEndDate) {
      setError('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const nextLabel = formatLabelFromDates(periodStartDate, periodEndDate)
      await updatePeriodLabel(period.id, nextLabel)
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Gagal update tanggal periode')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !sessionReady) {
    return <p className="status-message">Memuat panel admin...</p>
  }

  if (!isAdmin) {
    return (
      <section className="panel auth-panel">
        <h2>Login Admin</h2>
        <p>Masuk dengan akun Supabase yang sudah diberi role admin.</p>
        <form onSubmit={onLogin} className="stacked-form">
          <label>
            Email
            <input
              type="email"
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm((prev) => ({ ...prev, email: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((prev) => ({ ...prev, password: event.target.value }))
              }
              required
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        {error ? <p className="status-message error">{error}</p> : null}
      </section>
    )
  }

  return (
    <section className="layout-grid admin-grid">
      <article className="panel hero-panel admin-spotlight">
        <div className="winner-kicker">Area Pengelolaan</div>
        <h2 className="admin-title">Panel Admin</h2>
        <p className="admin-subtitle">Periode aktif: {readablePeriodLabel(period?.label)}</p>
      </article>

      <article className="panel">
        <h3>Edit Tanggal Periode</h3>
        <form onSubmit={onUpdatePeriodDate} className="inline-form period-form">
          <input
            type="date"
            value={periodStartDate}
            onChange={(event) => setPeriodStartDate(event.target.value)}
            required
          />
          <input
            type="date"
            value={periodEndDate}
            onChange={(event) => setPeriodEndDate(event.target.value)}
            required
          />
          <button type="submit" disabled={saving}>
            Simpan Tanggal
          </button>
        </form>
      </article>

      <article className="panel">
        <h3>Edit Pemenang Periode</h3>
        <form onSubmit={onUpdateWinner} className="inline-form">
          <input
            type="text"
            value={winnerName}
            onChange={(event) => setWinnerName(event.target.value)}
            placeholder="Nama pemenang"
            required
          />
          <button type="submit" disabled={saving}>
            Simpan
          </button>
        </form>
      </article>

      <article className="panel">
        <h3>Tambah Peserta</h3>
        <form onSubmit={onAddParticipant} className="inline-form">
          <input
            type="text"
            value={newParticipant}
            onChange={(event) => setNewParticipant(event.target.value)}
            placeholder="Nama peserta"
            required
          />
          <button type="submit" disabled={saving}>
            Tambah
          </button>
        </form>
      </article>

      <article className="panel table-panel">
        <h3>Kelola Pembayaran Peserta</h3>
        {paymentRows.length === 0 ? (
          <p>Belum ada peserta.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Urutan</th>
                <th>Status</th>
                <th>Nominal</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map(({ participant, payment }) => (
                <tr key={participant.id}>
                  <td>{participant.name}</td>
                  <td>
                    <div className="reorder-actions">
                      <button
                        type="button"
                        className="ghost mini-btn"
                        onClick={() => onMoveParticipant(participant.id, 'up')}
                        disabled={saving || !payment || participant.id === paymentRows[0]?.participant.id}
                        aria-label={`Naikkan urutan ${participant.name}`}
                      >
                        Naik
                      </button>
                      <button
                        type="button"
                        className="ghost mini-btn"
                        onClick={() => onMoveParticipant(participant.id, 'down')}
                        disabled={
                          saving ||
                          !payment ||
                          participant.id === paymentRows[paymentRows.length - 1]?.participant.id
                        }
                        aria-label={`Turunkan urutan ${participant.name}`}
                      >
                        Turun
                      </button>
                    </div>
                  </td>
                  <td>
                    <select
                      value={payment?.status || 'unpaid'}
                      onChange={(event) =>
                        onUpdatePayment(payment.id, event.target.value, payment.amount)
                      }
                      disabled={saving || !payment}
                    >
                      <option value="unpaid">Belum Bayar</option>
                      <option value="paid">Sudah Bayar</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      defaultValue={payment?.amount || 0}
                      onBlur={(event) =>
                        onUpdatePayment(payment.id, payment.status, event.target.value)
                      }
                      disabled={saving || !payment}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => onDeleteParticipant(participant.id)}
                      disabled={saving}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      {error ? <p className="status-message error">{error}</p> : null}
      <p className="hint">Nominal tersimpan saat input kehilangan fokus.</p>
      <p className="hint">Total nilai contoh: {currency(1500000)}</p>

      <article className="panel public-nav-panel admin-nav-panel">
        <nav className="public-nav" aria-label="Navigasi halaman">
          <Link to="/">Halaman Publik</Link>
          <Link to="/admin">Panel Admin</Link>
        </nav>
      </article>

      <article className="panel admin-logout-panel">
        <h3>Keluar Admin</h3>
        <button type="button" className="ghost" onClick={onLogout} disabled={saving}>
          Logout
        </button>
      </article>
    </section>
  )
}

export default AdminPage
