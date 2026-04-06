import { Client, Session, Socket, Match, MatchData } from '@heroiclabs/nakama-js';

export interface MatchPresenceEvent {
  joins?: Array<{ user_id: string; username: string; session_id: string; node: string }>;
  leaves?: Array<{ user_id: string; username: string; session_id: string; node: string }>;
}

export interface MatchmakerMatchedEvent {
  ticket: string;
  match_id: string;
  token: string;
  users: Array<{ presence: { user_id: string; username: string; session_id: string; node: string } }>;
  self: { presence: { user_id: string; username: string; session_id: string; node: string } };
}

class NakamaClient {
  private client: Client;
  private session: Session | null = null;
  private socket: Socket | null = null;
  private useSSL: boolean;

  constructor() {
    const host = process.env.REACT_APP_NAKAMA_HOST || 'localhost';
    const port = process.env.REACT_APP_NAKAMA_PORT || '7350';
    this.useSSL = process.env.REACT_APP_NAKAMA_SSL === 'true';
    this.client = new Client('defaultkey', host, port, this.useSSL, undefined, false);
  }

  async authenticate(username: string): Promise<Session> {
    const cleanUsername = username.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 20);
    // Device ID based on username - same name = same account
    const deviceId = 'ttt_device_' + cleanUsername.toLowerCase();
    this.session = await this.client.authenticateDevice(deviceId, true, cleanUsername);
    localStorage.setItem('ttt_username', cleanUsername);
    return this.session;
  }

  async connect(): Promise<void> {
    if (!this.session) throw new Error('Not authenticated');
    this.socket = this.client.createSocket(this.useSSL, false);
    await this.socket.connect(this.session, true);
  }

  async findMatch(mode: 'classic' | 'timed'): Promise<string> {
    if (!this.socket) throw new Error('Not connected');
    const response = await this.socket.rpc('find_match', JSON.stringify({ mode }));
    const data = typeof response.payload === 'string' ? JSON.parse(response.payload) : response.payload;
    return data.matchId;
  }

  async createMatch(mode: 'classic' | 'timed'): Promise<string> {
    if (!this.socket) throw new Error('Not connected');
    const response = await this.socket.rpc('create_match', JSON.stringify({ mode }));
    const data = typeof response.payload === 'string' ? JSON.parse(response.payload) : response.payload;
    return data.matchId;
  }

  async joinMatch(matchId: string): Promise<Match> {
    return await this.socket!.joinMatch(matchId);
  }

  async sendMove(matchId: string, position: number): Promise<void> {
    this.socket!.sendMatchState(matchId, 1, JSON.stringify({ position }));
  }

  async getLeaderboard(): Promise<any> {
    if (!this.socket) throw new Error('Not connected');
    const response = await this.socket.rpc('get_leaderboard', '{}');
    return typeof response.payload === 'string' ? JSON.parse(response.payload) : response.payload;
  }

  onMatchData(callback: (data: MatchData) => void): void {
    if (this.socket) this.socket.onmatchdata = callback;
  }

  onMatchPresence(callback: (event: MatchPresenceEvent) => void): void {
    if (this.socket) this.socket.onmatchpresence = callback;
  }

  onMatchmakerMatched(callback: (matched: MatchmakerMatchedEvent) => void): void {
    if (this.socket) (this.socket as any).onmatchmakermatched = callback;
  }

  async leaveMatch(matchId: string): Promise<void> {
    if (this.socket) await this.socket.leaveMatch(matchId);
  }

  async removeMatchmaker(ticket: string): Promise<void> {
    if (this.socket) await this.socket.removeMatchmaker(ticket);
  }

  disconnect(): void {
    if (this.socket) { this.socket.disconnect(false); this.socket = null; }
  }

  getUserId(): string | undefined { return this.session?.user_id; }
  getUsername(): string | undefined { return this.session?.username; }
  getSavedUsername(): string | null { return localStorage.getItem('ttt_username'); }
  getSession(): Session | null { return this.session; }
  getSocket(): Socket | null { return this.socket; }
}

const nakamaClient = new NakamaClient();
export default nakamaClient;
