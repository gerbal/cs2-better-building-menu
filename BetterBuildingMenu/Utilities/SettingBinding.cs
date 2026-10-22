namespace BetterBuildingMenu.Utilities
{
	/// <summary>The value a binding publishes to the UI at the next update, or last published.</summary>
	/// <remarks>What <see cref="SettingBinding{T}"/> drives, so it can be driven without a live UI.</remarks>
	internal interface IBindingValue<T>
	{
		T? Value { get; set; }
	}

	/// <summary>
	/// A binding that mirrors one of the mod's settings: seeded and re-pushed from it, set live by
	/// the UI, and saved back by a commit that changes it.
	/// </summary>
	/// <remarks>Set and Commit are apart so a drag publishes on every move and saves once, on release.</remarks>
	internal sealed class SettingBinding<T>
	{
		private readonly IBindingValue<T> _binding;
		private readonly Func<T> _read;
		// Null for a push-only binding.
		private readonly (Action<T> Write, Action Save)? _writeBack;
		private readonly Func<T, T> _sanitize;
		private readonly Func<T, T, bool> _same;

		/// <param name="create">Creates the binding, given the stored setting as its first value.</param>
		/// <param name="save">Applies and saves the settings, which pushes every setting binding again.</param>
		/// <param name="sanitize">Keeps a value fit to publish and store; values pass as they are without one.</param>
		/// <param name="same">Whether a value leaves the stored setting as it is; equality without one.</param>
		public SettingBinding(
			Func<T, IBindingValue<T>> create,
			Func<T> read,
			Action<T> write,
			Action save,
			Func<T, T>? sanitize = null,
			Func<T, T, bool>? same = null)
			: this(create, read, (write, save), sanitize, same)
		{
		}

		private SettingBinding(
			Func<T, IBindingValue<T>> create,
			Func<T> read,
			(Action<T> Write, Action Save)? writeBack,
			Func<T, T>? sanitize,
			Func<T, T, bool>? same)
		{
			_read = read;
			_writeBack = writeBack;
			_sanitize = sanitize ?? (value => value);
			_same = same ?? EqualityComparer<T>.Default.Equals;
			_binding = create(Stored);
		}

		/// <summary>A binding the UI only reads: seeded and re-pushed from the setting, with nothing to save to.</summary>
		public static SettingBinding<T> PushOnly(Func<T, IBindingValue<T>> create, Func<T> read) =>
			new(create, read, writeBack: null, sanitize: null, same: null);

		private T Stored => _sanitize(_read());

		/// <summary>Publishes the setting as it is stored now.</summary>
		public void Push() => _binding.Value = Stored;

		/// <summary>Publishes a value from the UI without saving it.</summary>
		public void Set(T value) => _binding.Value = _sanitize(value);

		/// <summary>Saves the published value, unless the stored setting already holds it.</summary>
		public void Commit()
		{
			var (write, save) = _writeBack
				?? throw new InvalidOperationException("A push-only setting binding has nothing to save to.");
			var value = _sanitize(_binding.Value!);

			if (_same(_read(), value))
			{
				return;
			}

			write(value);
			save();
		}

		/// <summary>Publishes a value from the UI and saves it at once, for a control with no drag to wait out.</summary>
		public void SetAndCommit(T value)
		{
			Set(value);
			Commit();
		}
	}
}
