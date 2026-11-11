// Link e navegação que mantêm o cargo atual (#/... para federal, #/estadual/... para estadual).
import { Link, useNavigate, type LinkProps } from 'react-router-dom'
import { useRota } from '../cargo'

export default function LinkC({ to, ...resto }: LinkProps & { to: string }) {
  const r = useRota()
  return <Link to={r(to)} {...resto} />
}

export function useNavegarC() {
  const navegar = useNavigate()
  const r = useRota()
  return (caminho: string) => navegar(r(caminho))
}
