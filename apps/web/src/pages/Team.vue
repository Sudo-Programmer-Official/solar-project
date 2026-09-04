<template>
  <main class="px-4 pb-4">
    <MobileHeader
      eyebrow="TEAM"
      title="People and permissions"
      subtitle="Live users and role membership from the platform database. One person can hold multiple operational roles."
    >
      <template #action>
        <span class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">{{ user.roleLabel }}</span>
      </template>
    </MobileHeader>

    <section class="page-surface p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="field-label">Team administration</p>
          <h2 class="mt-1 text-lg font-semibold text-slate-900">Live team</h2>
          <p class="mt-2 text-sm leading-6 text-slate-500">Role changes take effect on the next authenticated request. Deactivated users cannot sign in.</p>
        </div>
        <button
          v-if="user.can('team:create-user')"
          class="touch-target rounded-2xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white"
          type="button"
          @click="showAddUser = !showAddUser"
        >
          {{ showAddUser ? "Close" : "Add user" }}
        </button>
      </div>

      <p v-if="errorMessage" class="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{{ errorMessage }}</p>
      <p v-if="successMessage" class="mt-4 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{{ successMessage }}</p>

      <form v-if="showAddUser" class="mt-4 rounded-2xl border border-primary-200 bg-primary-50 p-4" @submit.prevent="createUser">
        <p class="field-label text-primary-700">Create team member</p>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <input v-model="draft.firstName" class="min-h-touch rounded-2xl border border-slate-200 bg-white px-3 text-sm" placeholder="First name" required />
          <input v-model="draft.lastName" class="min-h-touch rounded-2xl border border-slate-200 bg-white px-3 text-sm" placeholder="Last name" required />
          <input v-model="draft.email" class="min-h-touch rounded-2xl border border-slate-200 bg-white px-3 text-sm sm:col-span-2" placeholder="Email" type="email" required />
          <input v-model="draft.phone" class="min-h-touch rounded-2xl border border-slate-200 bg-white px-3 text-sm" placeholder="Phone (optional)" type="tel" />
          <input v-model="draft.password" class="min-h-touch rounded-2xl border border-slate-200 bg-white px-3 text-sm" placeholder="Temporary password or leave blank to invite" type="password" minlength="12" />
        </div>
        <label class="mt-3 grid gap-1 text-xs font-semibold text-slate-600 sm:max-w-xs">
          <span>Role</span>
          <select v-model="draftRole" class="min-h-touch w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" aria-label="Role">
            <option v-for="roleOption in assignableRoles" :key="roleOption" :value="roleOption">{{ roleLabel(roleOption) }}</option>
          </select>
          <span class="font-normal text-slate-500">Additional roles can be added from Edit roles after the member is created.</span>
        </label>
        <button class="touch-target mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="saving" type="submit">
          {{ saving ? "Saving…" : draft.password ? "Create user" : "Create and invite" }}
        </button>
      </form>
    </section>

    <section class="mt-4 page-surface p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="field-label">Database users</p>
          <h2 class="mt-1 text-lg font-semibold text-slate-900">{{ members.length }} team member{{ members.length === 1 ? "" : "s" }}</h2>
        </div>
        <button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="loadTeam">Refresh</button>
      </div>

      <div v-if="loading" class="mt-4 text-sm text-slate-500">Loading team…</div>
      <div v-else-if="members.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No team members were returned.</div>
      <div v-else class="mt-4 grid gap-3">
        <article v-for="member in members" :key="member.id" class="rounded-2xl border border-slate-200 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-slate-900">{{ member.displayName }}</h3>
                <span class="rounded-full px-2 py-1 text-[10px] font-bold" :class="member.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ member.active ? "ACTIVE" : "INACTIVE" }}</span>
              </div>
              <p class="mt-1 text-sm text-slate-500">{{ member.email }}<span v-if="member.phone"> · {{ member.phone }}</span></p>
            </div>
            <button v-if="user.can('team:update-user') && member.id !== user.id && canManageMember(member)" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="toggleActive(member)">
              {{ member.active ? "Deactivate" : "Reactivate" }}
            </button>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <span v-for="roleValue in member.roles" :key="roleValue" class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{{ roleValue }}</span>
          </div>
          <div v-if="member.roles.includes(PlatformRole.CLOSER)" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
            <div>
              <p class="text-[10px] font-bold tracking-[0.16em] text-slate-400">CLOSER AVAILABILITY</p>
              <p class="mt-1 text-sm font-semibold" :class="member.availabilityStatus === 'UNAVAILABLE' ? 'text-amber-700' : 'text-emerald-700'">● {{ member.availabilityStatus === 'UNAVAILABLE' ? 'Unavailable' : 'Available' }}</p>
            </div>
            <button v-if="user.can('team:update-user') && canManageMember(member)" class="touch-target rounded-2xl border px-3 py-2 text-xs font-semibold" :class="member.availabilityStatus === 'UNAVAILABLE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'" type="button" @click="toggleAvailability(member)">{{ member.availabilityStatus === 'UNAVAILABLE' ? 'Mark available' : 'Mark unavailable' }}</button>
          </div>
          <div v-if="editingId === member.id" class="mt-4 rounded-2xl bg-slate-50 p-3">
            <div class="flex flex-wrap gap-2">
              <button v-for="roleOption in assignableRoles" :key="roleOption" class="rounded-full border px-3 py-2 text-xs font-semibold" :class="editRoles.includes(roleOption) ? 'border-primary-300 bg-white text-primary-700' : 'border-slate-200 bg-white text-slate-600'" type="button" @click="toggleEditRole(roleOption)">{{ roleOption }}</button>
            </div>
            <div class="mt-3 flex gap-2">
              <button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="button" @click="saveRoles(member)">Save roles</button>
              <button class="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="editingId = null">Cancel</button>
            </div>
          </div>
          <div v-if="canManageMember(member) && (user.can('team:assign-role') || user.can('team:update-user'))" class="mt-4 flex flex-wrap gap-2">
            <button v-if="user.can('team:assign-role')" class="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="startEditing(member)">Edit roles</button>
            <button v-if="user.can('team:update-user')" class="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="prepareInvite(member)">Prepare invite</button>
          </div>
        </article>
      </div>
    </section>

    <section class="mt-4 grid gap-3">
      <article v-for="roleDefinition in roleDefinitions" :key="roleDefinition.code" class="page-surface p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="field-label">{{ roleDefinition.code }}</p>
            <h3 class="mt-1 text-base font-semibold text-slate-900">{{ roleDefinition.name }}</h3>
            <p class="mt-1 text-sm leading-6 text-slate-500">{{ roleDefinition.description }}</p>
          </div>
          <span class="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">{{ roleDefinition.permissions.length }} permissions</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <span v-for="permission in roleDefinition.permissions.slice(0, 6)" :key="permission" class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">{{ permission }}</span>
          <span v-if="roleDefinition.permissions.length > 6" class="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">+{{ roleDefinition.permissions.length - 6 }} more</span>
        </div>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { PLATFORM_ROLE_PERMISSIONS, PlatformRole, type PlatformPermission } from "@solar/contracts";
import MobileHeader from "../components/MobileHeader.vue";
import { createTeamInvite, createTeamMember, getTeamMembers, updateTeamMember, type TeamMember } from "../services/api";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const members = ref<TeamMember[]>([]);
const loading = ref(false);
const saving = ref(false);
const showAddUser = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const editingId = ref<string | null>(null);
const editRoles = ref<PlatformRole[]>([]);
const draft = ref({ firstName: "", lastName: "", email: "", phone: "", password: "", roles: [PlatformRole.SETTER] as PlatformRole[] });
const draftRole = computed<PlatformRole>({
  get: () => draft.value.roles[0] ?? assignableRoles.value[0] ?? PlatformRole.SETTER,
  set: (role) => {
    if (assignableRoles.value.includes(role)) draft.value.roles = [role];
  },
});
const roleDefinitions: Array<{ code: PlatformRole; name: string; description: string; permissions: readonly PlatformPermission[] | readonly ["*"] }> = [
  { code: PlatformRole.SETTER, name: "Setter", description: "Captures leads, creates appointments, uploads bills, and owns the early pipeline.", permissions: PLATFORM_ROLE_PERMISSIONS.SETTER },
  { code: PlatformRole.CLOSER, name: "Closer", description: "Works assigned appointments, captures outcomes, keeps appointment context current, and can create leads from the field.", permissions: PLATFORM_ROLE_PERMISSIONS.CLOSER },
  { code: PlatformRole.MANAGER, name: "Manager", description: "Runs team operations, assignments, reporting, and territory visibility.", permissions: PLATFORM_ROLE_PERMISSIONS.MANAGER },
  { code: PlatformRole.ADMIN, name: "Admin", description: "Manages users, roles, territory configuration, and operational reporting.", permissions: PLATFORM_ROLE_PERMISSIONS.ADMIN },
  { code: PlatformRole.SUPER_ADMIN, name: "Super Admin", description: "Full platform access, Labs, and system configuration.", permissions: ["*"] },
];
const assignableRoles = computed(() => {
  if (user.roles.includes(PlatformRole.SUPER_ADMIN)) {
    return [PlatformRole.SUPER_ADMIN, PlatformRole.ADMIN, PlatformRole.MANAGER, PlatformRole.SETTER, PlatformRole.CLOSER];
  }
  if (user.roles.includes(PlatformRole.ADMIN)) return [PlatformRole.MANAGER, PlatformRole.SETTER, PlatformRole.CLOSER];
  if (user.roles.includes(PlatformRole.MANAGER)) return [PlatformRole.SETTER, PlatformRole.CLOSER];
  return [PlatformRole.SETTER];
});

onMounted(() => { void loadTeam(); });

async function loadTeam() {
  if (!user.can("team:view")) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    members.value = await getTeamMembers();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load the team.";
  } finally {
    loading.value = false;
  }
}

function toggleEditRole(role: PlatformRole) {
  editRoles.value = toggleRoleValue(editRoles.value, role);
}

async function createUser() {
  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const response = await createTeamMember({ ...draft.value, password: draft.value.password || undefined });
    members.value = [...members.value, response.user];
    const inviteMessage = response.invite ? ` Invite expires ${new Date(response.invite.expiresAt).toLocaleDateString()}.${response.invite.token ? ` Token: ${response.invite.token}` : ""}` : "";
    successMessage.value = `Created ${response.user.displayName}.${response.user.mustChangePassword ? " Temporary password required to change on first login." : ""}${inviteMessage}`;
    draft.value = { firstName: "", lastName: "", email: "", phone: "", password: "", roles: [PlatformRole.SETTER] };
    showAddUser.value = false;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to create the user.";
  } finally {
    saving.value = false;
  }
}

function startEditing(member: TeamMember) {
  editingId.value = member.id;
  editRoles.value = [...member.roles];
}

async function saveRoles(member: TeamMember) {
  if (editRoles.value.length === 0) return;
  try {
    const updated = await updateTeamMember(member.id, { roles: editRoles.value });
    replaceMember(updated);
    editingId.value = null;
    successMessage.value = `Updated roles for ${updated.displayName}.`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to update roles.";
  }
}

async function toggleActive(member: TeamMember) {
  try {
    const updated = await updateTeamMember(member.id, { active: !member.active });
    replaceMember(updated);
    successMessage.value = `${updated.displayName} is now ${updated.active ? "active" : "inactive"}.`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to update the user.";
  }
}

async function toggleAvailability(member: TeamMember) {
  try {
    const nextStatus = member.availabilityStatus === "UNAVAILABLE" ? "AVAILABLE" : "UNAVAILABLE";
    const updated = await updateTeamMember(member.id, { availabilityStatus: nextStatus });
    replaceMember(updated);
    successMessage.value = `${updated.displayName} is now ${nextStatus === "AVAILABLE" ? "available" : "unavailable"} for new assignments.`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to update closer availability.";
  }
}

async function prepareInvite(member: TeamMember) {
  try {
    const invite = await createTeamInvite(member.id);
    successMessage.value = `Invite prepared for ${member.displayName}; it expires ${new Date(invite.expiresAt).toLocaleDateString()}.${invite.token ? ` Token: ${invite.token}` : ""}`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to prepare the invite.";
  }
}

function replaceMember(updated: TeamMember) {
  members.value = members.value.map((member) => member.id === updated.id ? updated : member);
}

function toggleRoleValue(values: PlatformRole[], role: PlatformRole): PlatformRole[] {
  return values.includes(role) ? values.filter((value) => value !== role) : [...values, role];
}

function roleLabel(role: PlatformRole): string {
  return roleDefinitions.find((definition) => definition.code === role)?.name ?? role.replaceAll("_", " ");
}

function canManageMember(member: TeamMember): boolean {
  return member.roles.every((role) => assignableRoles.value.includes(role));
}
</script>
