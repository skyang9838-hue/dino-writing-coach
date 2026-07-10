import { redirect } from 'next/navigation'
import { auth } from '../../../auth.js'
import { NewActivityForm } from '../../../components/NewActivityForm.jsx'

export default async function NewActivityPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="container">
      <h1 style={{ fontSize: '1.4rem' }}>새 활동 만들기</h1>
      <NewActivityForm />
    </div>
  )
}
