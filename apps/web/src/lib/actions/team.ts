'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@kyra/database'

async function getServerContext() {
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Não autenticado')
  const admin = createAdminSupabaseClient()
  const { data: profileData } = await (admin as any)
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()
  const profile = profileData as { company_id: string | null; role: string | null } | null
  if (!profile?.company_id) throw new Error('Empresa não encontrada')
  return { supabase, admin, companyId: profile.company_id as string, userId: user.id, myRole: profile.role as string }
}

// ── Types ──────────────────────────────────────────────────────

export interface TeamMember {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  role: string
  isActive: boolean
  joinedAt: string
}

export interface CompanyRole {
  id: string
  name: string
  description: string | null
  permissions: string[]
  isDefault: boolean
  isSystem: boolean
}

// ── Permission catalog ─────────────────────────────────────────

// ── Team members ───────────────────────────────────────────────

export async function getTeamMembers(): Promise<TeamMember[]> {
  try {
    const { admin, companyId } = await getServerContext()
    const { data } = await (admin as any)
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, is_active, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
    return (data ?? []).map((p: any) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name || p.email,
      avatarUrl: p.avatar_url ?? null,
      role: p.role,
      isActive: p.is_active,
      joinedAt: p.created_at,
    }))
  } catch {
    return []
  }
}

export async function updateMemberRole(
  userId: string,
  role: string
): Promise<{ success: boolean; error?: string; inviteLink?: string }> {
  try {
    const { admin, companyId, userId: myId, myRole } = await getServerContext()
    if (!['owner', 'admin'].includes(myRole)) return { success: false, error: 'Sem permissão' }
    if (userId === myId) return { success: false, error: 'Não é possível alterar o próprio perfil' }
    // Não pode promover para owner
    if (role === 'owner') return { success: false, error: 'Não é possível atribuir papel de proprietário' }

    const { error } = await (admin as any)
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .eq('company_id', companyId)

    if (error) return { success: false, error: (error as any).message ?? String(error) }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function removeMember(
  userId: string
): Promise<{ success: boolean; error?: string; inviteLink?: string }> {
  try {
    const { admin, companyId, userId: myId, myRole } = await getServerContext()
    if (!['owner', 'admin'].includes(myRole)) return { success: false, error: 'Sem permissão' }
    if (userId === myId) return { success: false, error: 'Não é possível remover a si mesmo' }

    // Não pode remover o último owner
    const { data: targetData } = await (admin as any).from('profiles').select('role').eq('id', userId).eq('company_id', companyId).single()
    const target = targetData as { role: string | null } | null
    if (target?.role === 'owner') {
      const { count } = await (admin as any).from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('role', 'owner')
      if ((count ?? 0) <= 1) return { success: false, error: 'Não é possível remover o único proprietário' }
    }

    // Remove: desvincula da empresa (company_id = null, is_active = false)
    const { error } = await (admin as any)
      .from('profiles')
      .update({ company_id: null, is_active: false })
      .eq('id', userId)
      .eq('company_id', companyId)

    if (error) return { success: false, error: (error as any).message ?? String(error) }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── Roles (perfis de permissão) ────────────────────────────────

export async function getRoles(): Promise<CompanyRole[]> {
  try {
    const { admin, companyId } = await getServerContext()
    const { data } = await (admin as any)
      .from('roles')
      .select('id, name, description, permissions, is_default, is_system')
      .eq('company_id', companyId)
      .order('is_system', { ascending: false })
      .order('name')
    return (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      permissions: (r.permissions as string[]) ?? [],
      isDefault: r.is_default,
      isSystem: r.is_system,
    }))
  } catch {
    return []
  }
}

export async function createRole(input: {
  name: string
  description?: string
  permissions: string[]
}): Promise<{ success: boolean; error?: string; inviteLink?: string }> {
  try {
    const { admin, companyId, myRole } = await getServerContext()
    if (!['owner', 'admin'].includes(myRole)) return { success: false, error: 'Sem permissão' }

    const { error } = await (admin as any).from('roles').insert({
      company_id: companyId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      permissions: input.permissions,
      is_system: false,
      is_default: false,
    })

    if (error) return { success: false, error: (error as any).message ?? String(error) }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function updateRole(
  roleId: string,
  input: { name?: string; description?: string | null; permissions?: string[]; isDefault?: boolean }
): Promise<{ success: boolean; error?: string; inviteLink?: string }> {
  try {
    const { admin, companyId, myRole } = await getServerContext()
    if (!['owner', 'admin'].includes(myRole)) return { success: false, error: 'Sem permissão' }

    const update: Record<string, unknown> = {}
    if (input.name !== undefined) update.name = input.name.trim()
    if (input.description !== undefined) update.description = input.description
    if (input.permissions !== undefined) update.permissions = input.permissions
    if (input.isDefault !== undefined) {
      // Desativa is_default em outros roles ao marcar um como padrão
      if (input.isDefault) {
        await (admin as any).from('roles').update({ is_default: false }).eq('company_id', companyId)
      }
      update.is_default = input.isDefault
    }

    const { error } = await (admin as any).from('roles').update(update).eq('id', roleId).eq('company_id', companyId)
    if (error) return { success: false, error: (error as any).message ?? String(error) }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function deleteRole(roleId: string): Promise<{ success: boolean; error?: string; inviteLink?: string }> {
  try {
    const { admin, companyId, myRole } = await getServerContext()
    if (!['owner', 'admin'].includes(myRole)) return { success: false, error: 'Sem permissão' }

    const { data: roleRowData } = await (admin as any).from('roles').select('is_system').eq('id', roleId).eq('company_id', companyId).single()
    const role = roleRowData as { is_system: boolean } | null
    if (role?.is_system) return { success: false, error: 'Não é possível excluir perfis do sistema' }

    const { error } = await (admin as any).from('roles').delete().eq('id', roleId).eq('company_id', companyId)
    if (error) return { success: false, error: (error as any).message ?? String(error) }
    revalidatePath('/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function inviteMember(
  email: string,
  role: string,
): Promise<{ success: boolean; error?: string; inviteLink?: string }> {
  try {
    const { admin, companyId, myRole } = await getServerContext()
    if (!['owner', 'admin'].includes(myRole)) return { success: false, error: 'Sem permissão' }

    // Check if already a member of THIS company
    const { data: existing } = await (admin as any)
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('email', email)
      .maybeSingle()
    if (existing) return { success: false, error: 'Este e-mail já é membro da equipe' }

    // Check if user already exists in Supabase Auth (fetch all, match by email)
    const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 } as any)
    const existingAuthUser = authList?.users?.find((u: any) => u.email === email)

    let userId: string
    let inviteLink: string | undefined

    if (existingAuthUser) {
      // User already in Auth — just link to this company, no invite needed
      userId = existingAuthUser.id
    } else {
      // Generate invite link via Supabase Auth
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { data: { company_id: companyId, role } },
      })
      if (linkError) return { success: false, error: linkError.message }
      userId = linkData.user.id
      const actionLink = linkData.properties?.action_link

      // Send email via Resend REST API (no package needed)
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey && actionLink) {
        const roleLabel = { owner: 'Proprietário', admin: 'Administrador', manager: 'Gerente', member: 'Membro', viewer: 'Visualizador' }[role] ?? role
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Kyra Estoque <admin@kyraestoque.com.br>',
            to: [email],
            subject: 'Você foi convidado para o Kyra Estoque',
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
                <img src="https://kyraestoque.com.br/logo.png" alt="Kyra" style="height:36px;margin-bottom:24px" />
                <h2 style="font-size:20px;font-weight:700;margin:0 0 8px">Você foi convidado!</h2>
                <p style="color:#6b7280;margin:0 0 24px">Você foi adicionado como <strong>${roleLabel}</strong> no Kyra Estoque. Clique no botão abaixo para criar sua senha e acessar o sistema.</p>
                <a href="${actionLink}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px">Aceitar convite</a>
                <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">Este link expira em 24 horas. Se não esperava este convite, ignore este e-mail.</p>
              </div>
            `,
          }),
        })
        if (!emailRes.ok) {
          const resendErr = await emailRes.json().catch(() => ({}))
          console.error('[inviteMember] Resend error:', emailRes.status, resendErr)
          inviteLink = actionLink
        }
        // Email sent successfully — no link needed
      } else {
        // No Resend key configured — return link for manual copy
        inviteLink = actionLink
      }
    }

    // Upsert profile into this company
    const { error: profileError } = await (admin as any).from('profiles').upsert(
      {
        id: userId,
        company_id: companyId,
        email,
        full_name: existingAuthUser?.user_metadata?.full_name ?? email.split('@')[0],
        role: role as any,
        is_active: !!existingAuthUser,
      },
      { onConflict: 'id' },
    )
    if (profileError) return { success: false, error: (profileError as any).message ?? String(profileError) }

    revalidatePath('/settings')
    return { success: true, inviteLink }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) }
  }
}
