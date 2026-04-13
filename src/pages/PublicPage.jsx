import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getActivePeriod,
  getParticipants,
  getPaymentsByPeriod,
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

function getInitials(name) {
  const value = String(name || '').trim()
  if (!value) {
    return '??'
  }

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')
}

function PublicPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState(null)
  const [participants, setParticipants] = useState([])
  const [payments, setPayments] = useState([])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError('')

        const [activePeriod, participantRows] = await Promise.all([
          getActivePeriod(),
          getParticipants(),
        ])

        setPeriod(activePeriod)
        setParticipants(participantRows)
        const paymentRows = await getPaymentsByPeriod(activePeriod.id)
        setPayments(paymentRows)
      } catch (err) {
        setError(err.message || 'Gagal mengambil data publik')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const participantRows = useMemo(() => {
    const paymentMap = new Map(payments.map((item) => [item.participant_id, item]))

    return participants.map((participant) => {
      const payment = paymentMap.get(participant.id)
      return {
        ...participant,
        status: payment?.status || 'unpaid',
        amount: Number(payment?.amount || 0),
      }
    })
  }, [participants, payments])

  const stats = useMemo(() => {
    const paidCount = participantRows.filter((item) => item.status === 'paid').length
    const unpaidCount = participantRows.length - paidCount
    const totalCollected = participantRows.reduce((sum, item) => sum + item.amount, 0)

    return { paidCount, unpaidCount, totalCollected }
  }, [participantRows])

  if (loading) {
    return <p className="status-message">Memuat data publik...</p>
  }

  if (error) {
    return <p className="status-message error">{error}</p>
  }

  const winnerName = period?.winner_name?.trim() || ''
  const winnerReady = Boolean(winnerName)

  return (
    <section className="layout-grid">
      <article className="panel hero-panel winner-spotlight">
        <div className="winner-kicker">Pemenang Periode Ini</div>
        <div className="winner-content">
          <div className="winner-avatar" aria-hidden="true">
            {winnerReady ? getInitials(winnerName) : '??'}
          </div>
          <div>
            <h2 className="winner-title">{winnerReady ? winnerName : 'Belum ditentukan'}</h2>
            <p className="winner-subtitle">Periode: {readablePeriodLabel(period?.label)}</p>
            {!winnerReady ? (
              <p className="winner-waiting">Menunggu update admin untuk nama pemenang.</p>
            ) : null}
          </div>
        </div>
      </article>

      <article className="panel stats-panel">
        <h3>Ringkasan Pembayaran</h3>
        <div className="stats">
          <div>
            <span>Sudah Bayar</span>
            <strong>{stats.paidCount}</strong>
          </div>
          <div>
            <span>Belum Bayar</span>
            <strong>{stats.unpaidCount}</strong>
          </div>
          <div>
            <span>Total Terkumpul</span>
            <strong>{currency(stats.totalCollected)}</strong>
          </div>
        </div>
      </article>

      <article className="panel table-panel">
        <h3>Status Peserta</h3>
        {participantRows.length === 0 ? (
          <p>Belum ada peserta.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nama Peserta</th>
                <th>Status</th>
                <th>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {participantRows.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    <span className={`badge ${item.status}`}>
                      {item.status === 'paid' ? 'Sudah Bayar' : 'Belum Bayar'}
                    </span>
                  </td>
                  <td>{currency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      <article className="panel public-nav-panel">
        <nav className="public-nav" aria-label="Navigasi halaman">
          <Link to="/">Halaman Publik</Link>
          <Link to="/admin">Panel Admin</Link>
        </nav>
      </article>
    </section>
  )
}

export default PublicPage
