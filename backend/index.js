import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

// Inicializa Firebase Admin para verificar tokens del frontend
if(!admin.apps.length){
  admin.initializeApp({
    credential: admin.credential.applicationDefault() // o usa serviceAccount
  });
}

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

// Middleware de auth con Firebase
async function verifyAuth(req,res,next){
  try{
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if(!token) return res.status(401).json({error:'No token'});
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // uid disponible
    next();
  }catch(e){
    console.error(e);
    res.status(401).json({error:'Invalid token'});
  }
}

app.get('/api/ping', (_req,res)=> res.json({ok:true, name:'Juventud CNC API'}));

app.get('/api/activities', verifyAuth, async (_req,res)=>{
  const { data, error } = await supabase.from('activities').select('*').order('id',{ascending:false});
  if(error) return res.status(400).json({error:error.message});
  res.json(data);
});

app.post('/api/activities', verifyAuth, async (req,res)=>{
  const { title, date, place } = req.body;
  const { data, error } = await supabase.from('activities').insert({ title, date, place }).select().single();
  if(error) return res.status(400).json({error:error.message});
  res.status(201).json(data);
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, ()=> console.log(`API on :${PORT}`));