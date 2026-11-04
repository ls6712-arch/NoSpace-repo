// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => {
  const query = { select: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn() };
  return { query, from: vi.fn(() => query) };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from: mock.from } }));
import { markPursuitNoticesRead, PURSUIT_NOTICES_CHANGED, usePursuitNoticeCount } from './usePursuitNoticeCount';
beforeEach(() => { vi.clearAllMocks(); mock.query.select.mockReturnValue(mock.query); mock.query.update.mockReturnValue(mock.query); mock.query.eq.mockReturnValue(mock.query); mock.query.is.mockResolvedValue({count:3,error:null}); });
afterEach(cleanup);
describe('Pursuit notice bell integration', () => {
  it('counts unread notices scoped to the current user', async () => {
    const {result}=renderHook(()=>usePursuitNoticeCount('one'));
    await waitFor(()=>expect(result.current).toBe(3));
    expect(mock.query.eq).toHaveBeenCalledWith('user_id','one');
    expect(mock.query.is).toHaveBeenCalledWith('read_at',null);
  });
  it('resets when the account is cleared', async () => {
    const {result,rerender}=renderHook(({id}:{id?:string})=>usePursuitNoticeCount(id),{initialProps:{id:'one' as string|undefined}});
    await waitFor(()=>expect(result.current).toBe(3)); rerender({id:undefined});
    await waitFor(()=>expect(result.current).toBe(0));
  });
  it('refreshes immediately when notices are marked read', async () => {
    const {result}=renderHook(()=>usePursuitNoticeCount('one'));await waitFor(()=>expect(result.current).toBe(3));
    mock.query.is.mockResolvedValue({count:0,error:null});
    act(()=>window.dispatchEvent(new Event(PURSUIT_NOTICES_CHANGED)));
    await waitFor(()=>expect(result.current).toBe(0));
  });
  it('marks only the current recipient’s unread notices', async () => {
    await markPursuitNoticesRead('one');expect(mock.query.update).toHaveBeenCalledWith({read_at:expect.any(String)});expect(mock.query.eq).toHaveBeenCalledWith('user_id','one');expect(mock.query.is).toHaveBeenCalledWith('read_at',null);
  });
  it('surfaces real permission failures instead of pretending to mark read', async () => {
    mock.query.is.mockResolvedValue({error:{code:'42501',message:'denied'}});
    await expect(markPursuitNoticesRead('one')).rejects.toMatchObject({code:'42501'});
  });
});
