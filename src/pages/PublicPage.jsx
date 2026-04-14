import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getPeriods,
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
  const [switchingPeriod, setSwitchingPeriod] = useState(false)
  const [periods, setPeriods] = useState([])
  const [period, setPeriod] = useState(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [participants, setParticipants] = useState([])
  const [payments, setPayments] = useState([])
  const [showWinnerPopup, setShowWinnerPopup] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError('')

        const [periodRows, participantRows] = await Promise.all([
          getPeriods(),
          getParticipants(),
        ])

        if (!periodRows.length) {
          throw new Error('Belum ada periode yang tersedia')
        }

        const activePeriod = periodRows.find((item) => item.is_active) || periodRows[0]

        setPeriods(periodRows)
        setSelectedPeriodId(activePeriod.id)
        setPeriod(activePeriod)
        setParticipants(participantRows)
        const paymentRows = await getPaymentsByPeriod(activePeriod.id)
        setPayments(paymentRows)
        setShowWinnerPopup(true)
      } catch (err) {
        setError(err.message || 'Gagal mengambil data publik')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  async function onSelectPeriod(event) {
    const nextPeriodId = event.target.value
    if (!nextPeriodId || nextPeriodId === selectedPeriodId) {
      return
    }

    try {
      setSwitchingPeriod(true)
      setError('')
      setSelectedPeriodId(nextPeriodId)

      const nextPeriod = periods.find((item) => item.id === nextPeriodId)
      if (!nextPeriod) {
        throw new Error('Periode tidak ditemukan')
      }

      const paymentRows = await getPaymentsByPeriod(nextPeriodId)
      setPeriod(nextPeriod)
      setPayments(paymentRows)
    } catch (err) {
      setError(err.message || 'Gagal memuat riwayat periode')
    } finally {
      setSwitchingPeriod(false)
    }
  }

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
    <>
      {showWinnerPopup ? (
        <div className="winner-popup-backdrop" role="dialog" aria-modal="true" aria-label="Pemenang periode aktif">
          <article className="winner-popup-card">
            <button
              type="button"
              className="winner-popup-close"
              onClick={() => setShowWinnerPopup(false)}
              aria-label="Tutup popup"
            >
              X Tutup
            </button>
            <p className="winner-popup-kicker">PEMENANG PERIODE SAAT INI</p>
            <h3>{winnerReady ? winnerName : 'Belum ditentukan'}</h3>
            <p>Periode: {readablePeriodLabel(period?.label)}</p>
          </article>
        </div>
      ) : null}

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

        <article className="panel stats-panel">
          <h3>Riwayat Periode</h3>
          <form className="inline-form period-select-form" onSubmit={(event) => event.preventDefault()}>
            <select value={selectedPeriodId} onChange={onSelectPeriod} disabled={switchingPeriod}>
              {periods.map((item) => (
                <option key={item.id} value={item.id}>
                  {readablePeriodLabel(item.label)}{item.is_active ? ' (aktif)' : ''}
                </option>
              ))}
            </select>
            <span className="hint">{switchingPeriod ? 'Memuat periode...' : 'Pilih periode untuk melihat histori.'}</span>
          </form>
        </article>

        <article className="panel public-nav-panel">
          <nav className="public-nav" aria-label="Navigasi halaman">
            <Link to="/">Halaman Publik</Link>
            <Link to="/admin">Panel Admin</Link>
          </nav>
        </article>
      </section>
    </>
  )
}

export default PublicPage
