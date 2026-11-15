import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallPermissionSetup } from "./call-permission-setup";

const native = vi.hoisted(() => ({ getStatus: vi.fn(), requestCallLogPermission: vi.fn(), openAppSettings: vi.fn() }));
vi.mock("@/lib/native", () => ({ WinLogNative: native }));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe("call permission setup", () => {
  it("never queries Android permissions in a browser", () => {
    render(<CallPermissionSetup native={false} />);
    expect(native.getStatus).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "অনুমতি দিন" })).toBeDisabled();
  });
  it("reads back permission after requesting instead of trusting a successful prompt", async () => {
    native.getStatus.mockResolvedValue({ callLog: false });
    native.requestCallLogPermission.mockResolvedValue({ callLog: true });
    const onGranted = vi.fn();
    render(<CallPermissionSetup native onGranted={onGranted} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "অনুমতি দিন" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "অনুমতি দিন" }));
    await waitFor(() => expect(native.getStatus).toHaveBeenCalledTimes(2));
    expect(onGranted).not.toHaveBeenCalled();
  });
  it("only invokes granted handler after native read-back confirms access", async () => {
    native.getStatus.mockResolvedValueOnce({ callLog: false }).mockResolvedValue({ callLog: true });
    native.requestCallLogPermission.mockResolvedValue({ callLog: true });
    const onGranted = vi.fn();
    render(<CallPermissionSetup native onGranted={onGranted} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "অনুমতি দিন" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "অনুমতি দিন" }));
    await waitFor(() => expect(onGranted).toHaveBeenCalledTimes(1));
  });
  it("rechecks when returning from phone settings", async () => {
    native.getStatus.mockResolvedValue({ callLog: false });
    render(<CallPermissionSetup native />);
    await waitFor(() => expect(native.getStatus).toHaveBeenCalledTimes(1));
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(native.getStatus).toHaveBeenCalledTimes(2));
  });
});