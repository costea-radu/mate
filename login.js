import { createClient } from 'https://esm.sh/@supabase/supabase-js'

// 🔑 Înlocuiește cu datele tale Supabase
const supabaseUrl = 'https://https://supabase.com/dashboard/project/hamxcoojjmiibjuehaxi'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhbXhjb29qam1paWJqdWVoYXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyOTQ4NjAsImV4cCI6MjA2OTg3MDg2MH0.Gs8P10ZP5DgsMRH-ymZzy4PlFIa9fWSg_k7Kz4Lfurc'
const supabase = createClient(supabaseUrl, supabaseKey)

const form = document.getElementById('login-form')
const message = document.getElementById('message')

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    message.textContent = `Eroare: ${error.message}`
  } else {
    message.textContent = `Conectat cu succes!`
    console.log('User:', data.user)
  }
})
